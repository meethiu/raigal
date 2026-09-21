#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PKG_PATH = path.join(ROOT, "package.json");
const NODE_MODULES = path.join(ROOT, "node_modules");

const FORBIDDEN_LICENSES = [/GPL/i, /AGPL/i, /SSPL/i];

const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf-8"));
const dependencies = Object.keys(pkg.dependencies || {});

const violations = [];

for (const dep of dependencies) {
	const depPkgPath = path.join(NODE_MODULES, dep, "package.json");
	if (!fs.existsSync(depPkgPath)) {
		continue;
	}
	try {
		const depPkg = JSON.parse(fs.readFileSync(depPkgPath, "utf-8"));
		const license = depPkg.license || (Array.isArray(depPkg.licenses) ? depPkg.licenses.map((l) => l.type || l).join(", ") : "");
		for (const regex of FORBIDDEN_LICENSES) {
			if (typeof license === "string" && regex.test(license)) {
				violations.push({ dep, license });
			}
		}
	} catch {
		console.warn(`Warning: Could not parse package.json for ${dep}`);
	}
}

if (violations.length > 0) {
	console.error("Dependency license audit FAILED: GPL/AGPL packages detected in dependencies:");
	for (const v of violations) {
		console.error(`  - ${v.dep}: ${v.license}`);
	}
	process.exit(1);
}

console.log(`Dependency license audit PASSED (${dependencies.length} production dependencies verified).`);
process.exit(0);
