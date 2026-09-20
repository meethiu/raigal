import fs from "node:fs";
import path from "node:path";
import { safeProjectFilePath } from "./project-path-safety.js";

export const readRaigalIgnorePatterns = (rootDirectory: string): string[] => {
	const targetPath = safeProjectFilePath(path.join(rootDirectory, ".raigalignore"), rootDirectory);
	if (!targetPath || !fs.existsSync(targetPath)) return [];
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
