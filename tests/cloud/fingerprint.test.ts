import { describe, expect, it } from "vitest";
import { Finding } from "../../src/cloud/contract.js";
import {
	computeFindingFingerprint,
	normalizeLineText,
	toContractFinding,
} from "../../src/cloud/fingerprint.js";
import type { Diagnostic } from "../../src/engines/types.js";

describe("fingerprint calculation and privacy", () => {
	it("normalizes whitespace identically across styles", () => {
		expect(normalizeLineText("   const    x   =   1;  ")).toBe("const x = 1;");
		expect(normalizeLineText("\t\tconst\tx\t=\t1;\t")).toBe("const x = 1;");
		expect(normalizeLineText("const x = 1;")).toBe("const x = 1;");
	});

	it("produces deterministic 32-character hex sha256 fingerprints", () => {
		const fp1 = computeFindingFingerprint(
			"ai-slop/trivial-comment",
			"src/index.ts",
			"  // returns true  ",
		);
		const fp2 = computeFindingFingerprint(
			"ai-slop/trivial-comment",
			"src/index.ts",
			"// returns true",
		);
		const fp3 = computeFindingFingerprint(
			"ai-slop/trivial-comment",
			"src/other.ts",
			"// returns true",
		);

		expect(fp1).toHaveLength(32);
		expect(fp1).toMatch(/^[0-9a-f]{32}$/);
		expect(fp1).toBe(fp2); // Whitespace invariance
		expect(fp1).not.toBe(fp3); // Different path yields different fingerprint
	});

	it("converts Diagnostic to Contract Finding without sending source text", () => {
		const diag: Diagnostic = {
			rule: "security/hardcoded-secret",
			engine: "security",
			filePath: "/project/src/keys.ts",
			line: 42,
			column: 10,
			severity: "error",
			message: "Found secret key: sk_live_SUPER_SECRET_VALUE_12345",
			category: "Security",
		};

		const contractFinding = toContractFinding(diag, "/project", "const key = 'sk_live_SUPER_SECRET_VALUE_12345';");

		// Validates against contract Zod schema
		const parsed = Finding.safeParse(contractFinding);
		expect(parsed.success).toBe(true);

		expect(contractFinding.rule_id).toBe("security/hardcoded-secret");
		expect(contractFinding.engine).toBe("security");
		expect(contractFinding.path).toBe("src/keys.ts");
		expect(contractFinding.line).toBe(42);
		expect(contractFinding.severity).toBe("error");
		expect(contractFinding.fingerprint).toHaveLength(32);

		// Source text and secret message must never be present
		const json = JSON.stringify(contractFinding);
		expect(json).not.toContain("SUPER_SECRET_VALUE");
		expect(json).not.toContain("message");
	});
});
