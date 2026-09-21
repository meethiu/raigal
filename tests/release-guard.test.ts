import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const GUARD_SCRIPT = path.join(ROOT, "scripts", "release-guard.mjs");

describe("release-guard", () => {
	it("fails when LICENSE contains the placeholder token", () => {
		expect(() => {
			execFileSync(process.execPath, [GUARD_SCRIPT], {
				cwd: ROOT,
				stdio: "pipe",
			});
		}).toThrow();
	});
});
