import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CONTRACT_TS_PATH = path.resolve(__dirname, "../src/cloud/contract.ts");
const CONTRACT_SHA_PATH = path.resolve(__dirname, "../src/cloud/contract.sha256");

describe("contract drift", () => {
	it("asserts src/cloud/contract.ts matches contract.sha256", () => {
		expect(fs.existsSync(CONTRACT_TS_PATH)).toBe(true);
		expect(fs.existsSync(CONTRACT_SHA_PATH)).toBe(true);

		const content = fs.readFileSync(CONTRACT_TS_PATH);
		const expectedHash = fs.readFileSync(CONTRACT_SHA_PATH, "utf-8").trim();

		const actualHash = createHash("sha256").update(content).digest("hex");

		expect(actualHash).toBe(expectedHash);
	});
});
