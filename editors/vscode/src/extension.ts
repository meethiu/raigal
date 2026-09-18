import { execFile } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";
import * as vscode from "vscode";

interface RaigalDiagnostic {
	filePath: string;
	engine: string;
	rule: string;
	severity: "error" | "warning" | "info";
	message: string;
	line: number;
	column: number;
	fixable: boolean;
}

interface RaigalEnvelope {
	schemaVersion: string;
	score: number;
	diagnostics: RaigalDiagnostic[];
	summary: {
		errors: number;
		warnings: number;
		fixable: number;
		files: number;
	};
}

interface ScanOutcome {
	envelope: RaigalEnvelope;
	stderr: string;
}

class RaigalNotInstalledError extends Error {}
class UnsafeCliPathError extends Error {}

const SEVERITY_MAP: Record<RaigalDiagnostic["severity"], vscode.DiagnosticSeverity> = {
	error: vscode.DiagnosticSeverity.Error,
	warning: vscode.DiagnosticSeverity.Warning,
	info: vscode.DiagnosticSeverity.Information,
};

const toSeverity = (severity: RaigalDiagnostic["severity"]): vscode.DiagnosticSeverity =>
	SEVERITY_MAP[severity] ?? vscode.DiagnosticSeverity.Warning;

const DEFAULT_CLI = "raigal";

const getConfiguredCliPath = (): string => {
	const raigalInspected = vscode.workspace.getConfiguration("raigal").inspect<string>("path");
	if (raigalInspected?.globalValue || raigalInspected?.defaultValue) {
		return raigalInspected.globalValue ?? raigalInspected.defaultValue ?? DEFAULT_CLI;
	}
	const aislopInspected = vscode.workspace.getConfiguration("aislop").inspect<string>("path");
	return aislopInspected?.globalValue ?? aislopInspected?.defaultValue ?? DEFAULT_CLI;
};

const isPathLike = (command: string): boolean =>
	isAbsolute(command) || command.includes("/") || command.includes("\\");

const candidateNames = (command: string): string[] => {
	if (process.platform !== "win32") {
		return [command];
	}
	const hasExtension = /\.[^\\/]+$/.test(command);
	if (hasExtension) {
		return [command];
	}
	const extensions = (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
		.split(";")
		.filter(Boolean);
	return [command, ...extensions.map((extension) => `${command}${extension.toLowerCase()}`)];
};

const canExecute = (filePath: string): boolean => {
	try {
		accessSync(filePath, process.platform === "win32" ? constants.F_OK : constants.X_OK);
		return true;
	} catch {
		return false;
	}
};

const resolveCliPath = (command: string): string | undefined => {
	if (isPathLike(command)) {
		return isAbsolute(command) ? command : undefined;
	}
	for (const directory of (process.env.PATH ?? "").split(delimiter)) {
		if (!directory || directory === "." || !isAbsolute(directory)) {
			continue;
		}
		for (const candidate of candidateNames(command)) {
			const filePath = join(directory, candidate);
			if (canExecute(filePath)) {
				return filePath;
			}
		}
	}
	return undefined;
};

const getCliPath = (): string => {
	const configuredPath = getConfiguredCliPath().trim();
	if (!configuredPath) {
		throw new RaigalNotInstalledError("Raigal CLI path is empty");
	}
	const resolvedPath = resolveCliPath(configuredPath);
	if (!resolvedPath) {
		if (isPathLike(configuredPath)) {
			throw new UnsafeCliPathError("raigal.path must be an absolute path or a command on PATH");
		}
		throw new RaigalNotInstalledError("Raigal CLI not found on PATH");
	}
	return resolvedPath;
};

const isMissingBinary = (error: NodeJS.ErrnoException): boolean =>
	error.code === "ENOENT" || /not found|not recognized/i.test(error.message);

const runScan = (target: string, cwd: string): Promise<ScanOutcome> =>
	new Promise((resolve, reject) => {
		execFile(
			getCliPath(),
			["scan", target, "--json"],
			{ cwd, maxBuffer: 16 * 1024 * 1024 },
			(error, stdout, stderr) => {
				if (error && isMissingBinary(error as NodeJS.ErrnoException)) {
					reject(new RaigalNotInstalledError(error.message));
					return;
				}
				if (!stdout.trim()) {
					reject(new Error(stderr.trim() || (error ? error.message : "raigal produced no output")));
					return;
				}
				try {
					const envelope = JSON.parse(stdout) as RaigalEnvelope;
					resolve({ envelope, stderr });
				} catch {
					reject(new Error("Failed to parse raigal JSON output"));
				}
			},
		);
	});

const toDiagnostic = (finding: RaigalDiagnostic): vscode.Diagnostic => {
	const line = Math.max(0, finding.line - 1);
	const column = Math.max(0, finding.column - 1);
	const range = new vscode.Range(line, column, line, column + 1);
	const diagnostic = new vscode.Diagnostic(range, finding.message, toSeverity(finding.severity));
	diagnostic.source = "raigal";
	diagnostic.code = `${finding.engine}/${finding.rule}`;
	return diagnostic;
};

const publishDiagnostics = (
	collection: vscode.DiagnosticCollection,
	envelope: RaigalEnvelope,
	scopedFile?: vscode.Uri,
): void => {
	if (scopedFile) {
		collection.set(scopedFile, envelope.diagnostics.map(toDiagnostic));
		return;
	}
	collection.clear();
	const byFile = new Map<string, vscode.Diagnostic[]>();
	for (const finding of envelope.diagnostics) {
		const existing = byFile.get(finding.filePath) ?? [];
		existing.push(toDiagnostic(finding));
		byFile.set(finding.filePath, existing);
	}
	for (const [filePath, diagnostics] of byFile) {
		collection.set(vscode.Uri.file(filePath), diagnostics);
	}
};

const updateStatusBar = (item: vscode.StatusBarItem, envelope: RaigalEnvelope): void => {
	item.text = `$(shield) Raigal ${envelope.score}/100`;
	item.tooltip = `${envelope.summary.errors} errors, ${envelope.summary.warnings} warnings (${envelope.summary.fixable} fixable)`;
	item.show();
};

const reportFailure = (error: unknown, status: vscode.StatusBarItem): void => {
	if (error instanceof RaigalNotInstalledError) {
		status.text = "$(shield) Raigal: not installed";
		status.tooltip = "Install the Raigal CLI: npm i -g raigal";
		status.show();
		void vscode.window.showWarningMessage(
			"Raigal CLI not found. Install it with `npm i -g raigal` or set the user-level `raigal.path` setting.",
		);
		return;
	}
	if (error instanceof UnsafeCliPathError) {
		status.text = "$(shield) Raigal: invalid CLI path";
		status.tooltip = error.message;
		status.show();
		void vscode.window.showWarningMessage(error.message);
		return;
	}
	const message = error instanceof Error ? error.message : String(error);
	void vscode.window.showErrorMessage(`raigal scan failed: ${message}`);
};

const scan = async (
	target: string,
	cwd: string,
	collection: vscode.DiagnosticCollection,
	status: vscode.StatusBarItem,
	scopedFile?: vscode.Uri,
): Promise<void> => {
	try {
		const { envelope } = await runScan(target, cwd);
		publishDiagnostics(collection, envelope, scopedFile);
		updateStatusBar(status, envelope);
	} catch (error) {
		reportFailure(error, status);
	}
};

const workspaceRoot = (uri?: vscode.Uri): vscode.WorkspaceFolder | undefined => {
	if (uri) {
		const folder = vscode.workspace.getWorkspaceFolder(uri);
		if (folder) {
			return folder;
		}
	}
	return vscode.workspace.workspaceFolders?.[0];
};

export const activate = (context: vscode.ExtensionContext): void => {
	const collection = vscode.languages.createDiagnosticCollection("raigal");
	const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	status.command = "raigal.scanWorkspace";
	context.subscriptions.push(collection, status);

	const scanWorkspace = (): void => {
		const folder = workspaceRoot();
		if (!folder) {
			void vscode.window.showInformationMessage("raigal: open a folder to scan.");
			return;
		}
		void scan(folder.uri.fsPath, folder.uri.fsPath, collection, status);
	};

	const scanDocument = (document: vscode.TextDocument): void => {
		if (document.uri.scheme !== "file") {
			return;
		}
		const folder = workspaceRoot(document.uri);
		const cwd = folder ? folder.uri.fsPath : document.uri.fsPath;
		void scan(document.uri.fsPath, cwd, collection, status, document.uri);
	};

	context.subscriptions.push(
		vscode.commands.registerCommand("raigal.scanWorkspace", scanWorkspace),
		vscode.commands.registerCommand("aislop.scanWorkspace", scanWorkspace),
		vscode.workspace.onDidSaveTextDocument((document) => {
			const scanOnSave =
				vscode.workspace.getConfiguration("raigal").get<boolean>("scanOnSave") ??
				vscode.workspace.getConfiguration("aislop").get<boolean>("scanOnSave", true);
			if (scanOnSave) {
				scanDocument(document);
			}
		}),
	);

	scanWorkspace();
};

export const deactivate = (): void => {};
