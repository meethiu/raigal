#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Allowed PostHog project API keys (empty by default; unauthorized keys fail the build).
const ALLOWED_KEYS = new Set([]);

// Break literal pattern to prevent detector self-matching
const PH_KEY_PREFIX = `${"p" + "h" + "c"}_`;
const PH_KEY_PATTERN = new RegExp(`${PH_KEY_PREFIX}[A-Za-z0-9_-]{20,}`, "g");

const ROOT_DIR = path.resolve(import.meta.dirname, "..");

const walkDirectory = (dir, callback) => {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walkDirectory(fullPath, callback);
		} else if (entry.isFile()) {
			callback(fullPath);
		}
	}
};

let tarballPath = null;
let extractDir = null;

try {
	// 1. Pack the package tarball
	const packOutput = execSync("npm pack", {
		cwd: ROOT_DIR,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();

	const lines = packOutput.split("\n");
	const tarballName = lines[lines.length - 1]?.trim();
	if (!tarballName || !tarballName.endsWith(".tgz")) {
		throw new Error(`Unexpected npm pack output: "${packOutput}"`);
	}

	tarballPath = path.join(ROOT_DIR, tarballName);
	if (!fs.existsSync(tarballPath)) {
		throw new Error(`Packed tarball not found at ${tarballPath}`);
	}

	// 2. Extract into a temporary directory
	extractDir = fs.mkdtempSync(path.join(os.tmpdir(), "raigal-tarball-"));
	execSync(`tar -xzf "${tarballPath}" -C "${extractDir}"`, {
		stdio: "ignore",
	});

	const packageDir = path.join(extractDir, "package");
	if (!fs.existsSync(packageDir)) {
		throw new Error(`Extracted package directory not found at ${packageDir}`);
	}

	// 3. Scan all extracted files for unapproved PostHog keys
	const unauthorizedKeys = [];

	walkDirectory(packageDir, (filePath) => {
		// Only check text / script / metadata files
		try {
			const content = fs.readFileSync(filePath, "utf-8");
			const matches = content.match(PH_KEY_PATTERN);
			if (matches) {
				for (const match of matches) {
					if (!ALLOWED_KEYS.has(match)) {
						const relPath = path.relative(packageDir, filePath);
						unauthorizedKeys.push({ key: match, file: relPath });
					}
				}
			}
		} catch {
			// Skip binary files that cannot be decoded as utf-8
		}
	});

	if (unauthorizedKeys.length > 0) {
		console.error("Tarball PostHog key check FAILED: Unauthorized keys found in package:");
		for (const item of unauthorizedKeys) {
			console.error(`  - Key "${item.key}" in file "${item.file}"`);
		}
		process.exit(1);
	}

	console.log("Tarball key check passed: No unauthorized PostHog keys found in package.");
	process.exit(0);
} catch (err) {
	console.error(`Tarball key check error: ${err instanceof Error ? err.message : String(err)}`);
	process.exit(1);
} finally {
	if (tarballPath && fs.existsSync(tarballPath)) {
		try {
			fs.rmSync(tarballPath, { force: true });
		} catch {}
	}
	if (extractDir && fs.existsSync(extractDir)) {
		try {
			fs.rmSync(extractDir, { recursive: true, force: true });
		} catch {}
	}
}
