#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LICENSE_PATH = path.join(ROOT, "LICENSE");

const PLACEHOLDER_TOKEN = "[LICENCE TEXT TO BE SUPPLIED BY COUNSEL]";

if (!fs.existsSync(LICENSE_PATH)) {
	console.error("Release guard error: LICENSE file is missing.");
	process.exit(1);
}

const content = fs.readFileSync(LICENSE_PATH, "utf-8");

if (content.includes(PLACEHOLDER_TOKEN)) {
	console.error(
		"Release guard error: LICENSE still contains placeholder token:\n" +
			`  "${PLACEHOLDER_TOKEN}"\n` +
			"Counsel must provide approved proprietary licence terms before release.",
	);
	process.exit(1);
}

console.log("Release guard passed: LICENSE has been replaced with final legal terms.");
process.exit(0);
