import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const CHECK_SCRIPT = path.join(ROOT, "scripts", "check-licenses.mjs");

describe("license audit", () => {
	it("verifies no GPL/AGPL packages exist in dependencies", () => {
		const result = execFileSync(process.execPath, [CHECK_SCRIPT], {
			cwd: ROOT,
			encoding: "utf-8",
		});
		expect(result).toContain("Dependency license audit PASSED");
	});
});
