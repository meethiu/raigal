import fs from "node:fs";
import path from "node:path";
import { safeProjectFilePath } from "./project-path-safety.js";

export const readRaigalIgnorePatterns = (rootDirectory: string): string[] => {
	const raigalPath = safeProjectFilePath(path.join(rootDirectory, ".raigalignore"), rootDirectory);
	const targetPath =
		raigalPath && fs.existsSync(raigalPath)
			? raigalPath
			: safeProjectFilePath(path.join(rootDirectory, ".aislopignore"), rootDirectory);
	if (!targetPath) return [];
	try {
		return fs
			.readFileSync(targetPath, "utf-8")
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && !line.startsWith("#"));
	} catch {
		return [];
	}
};

export const readAislopIgnorePatterns = readRaigalIgnorePatterns;
