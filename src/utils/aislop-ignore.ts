import fs from "node:fs";
import path from "node:path";
import { safeProjectFilePath } from "./project-path-safety.js";

export const readRaigalIgnorePatterns = (rootDirectory: string): string[] => {
	const patterns: string[] = [];
	for (const fileName of [".raigalignore", ".aislopignore"]) {
		const targetPath = safeProjectFilePath(path.join(rootDirectory, fileName), rootDirectory);
		if (targetPath && fs.existsSync(targetPath)) {
			try {
				const lines = fs
					.readFileSync(targetPath, "utf-8")
					.split(/\r?\n/)
					.map((line) => line.trim())
					.filter((line) => line.length > 0 && !line.startsWith("#"));
				patterns.push(...lines);
			} catch {
				/* ignore read error */
			}
		}
	}
	return patterns;
};

export const readAislopIgnorePatterns = readRaigalIgnorePatterns;
