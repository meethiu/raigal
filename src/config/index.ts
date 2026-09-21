import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG } from "./defaults.js";
import { loadConfigChain } from "./extends.js";
import { type AislopConfig, ConfigError, validateConfig } from "./schema.js";

export const CONFIG_DIR = ".raigal";
export const CONFIG_FILE = "config.yml";
export const RULES_FILE = "rules.yml";

const CONFIG_CANDIDATE_DIRS = [".raigal", ".aislop"];
const CONFIG_FILE_NAMES = ["config.yaml", "config.yml", "config.json"];
const ROOT_CONFIG_FILES = [
	".raigal.json",
	".raigal.yaml",
	".raigal.yml",
	".aislop.json",
	".aislop.yaml",
	".aislop.yml",
];

const findConfigFile = (startDir: string, stopAt?: string): string | null => {
	let current = path.resolve(startDir);
	const boundary = stopAt ? path.resolve(stopAt) : null;
	while (true) {
		for (const dirName of CONFIG_CANDIDATE_DIRS) {
			for (const fileName of CONFIG_FILE_NAMES) {
				const candidate = path.join(current, dirName, fileName);
				if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
					return candidate;
				}
			}
		}
		for (const fileName of ROOT_CONFIG_FILES) {
			const candidate = path.join(current, fileName);
			if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
				return candidate;
			}
		}
		if (boundary && current === boundary) break;
		const parent = path.dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return null;
};

export const findConfigDir = (startDir: string, stopAt?: string): string | null => {
	let current = path.resolve(startDir);
	const boundary = stopAt ? path.resolve(stopAt) : null;
	while (true) {
		for (const dirName of CONFIG_CANDIDATE_DIRS) {
			const candidate = path.join(current, dirName);
			if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
				return candidate;
			}
		}
		if (boundary && current === boundary) break;
		const parent = path.dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return null;
};

export const loadConfig = (directory: string): AislopConfig => {
	const configPath = findConfigFile(directory);
	if (!configPath) return DEFAULT_CONFIG;

	try {
		const merged = loadConfigChain(configPath);
		return validateConfig(merged, configPath);
	} catch (error) {
		if (error instanceof ConfigError) {
			throw error;
		}
		const msg = error instanceof Error ? error.message : String(error);
		process.stderr.write(
			`  ⚠ Failed to parse ${configPath}: ${msg}\n  ⚠ Using default configuration.\n`,
		);
		return DEFAULT_CONFIG;
	}
};

export type { AislopConfig } from "./schema.js";
export { ConfigError } from "./schema.js";
