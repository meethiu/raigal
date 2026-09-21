import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectTrivialComments } from "../src/engines/ai-slop/comments.js";
import { detectNarrativeComments } from "../src/engines/ai-slop/narrative-comments.js";
import { fixNarrativeComments } from "../src/engines/ai-slop/narrative-comments-fix.js";
import type { EngineContext } from "../src/engines/types.js";
import {
	extractStringAndTemplateLiterals,
	isCommentAtLine,
	maskComments,
	maskStringsAndComments,
} from "../src/utils/source-masker.js";

let tmpDir: string;

const makeContext = (files: string[]): EngineContext => ({
	rootDirectory: tmpDir,
	languages: ["typescript"],
	frameworks: ["none"],
	files,
	installedTools: {},
	config: {
		quality: { maxFunctionLoc: 80, maxFileLoc: 400, maxNesting: 5, maxParams: 6 },
		security: { audit: true, auditTimeout: 25000 },
		lint: { typecheck: false, expoDoctor: false },
	},
});

const writeFile = (filename: string, content: string): string => {
	const filePath = path.join(tmpDir, filename);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, content, "utf-8");
	return filePath;
};

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "raigal-tpl-safety-"));
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("Task 4: Template literal and string safety in scan and fix", () => {
	const testCases = [
		{
			name: "multi-line template with // comment syntax inside",
			code: 'export const tpl = `\n// Import nothing\n${"val"}\n`;\n',
		},
		{
			name: "multi-line template with /* comment syntax inside",
			code: 'export const tpl = `\n/* Initialize the store */\n${"val"}\n`;\n',
		},
		{
			name: "template with ${expr}, nested templates and braces",
			code: 'export const tpl = `result: ${JSON.stringify({ a: `${1 + 2}`, b: "{" })} end`;\n',
		},
		{
			name: "tagged template literal (sql)",
			code: "export const q = sql`\n// SELECT * FROM users\nWHERE id = ${1}\n`;\n",
		},
		{
			name: "regex literal containing //",
			code: "export const re = /\\/\\/ Initialize the thing/;\nexport const urlRe = /https?:\\/\\/[a-z.]+/;\n",
		},
		{
			name: "strings with URLs and //",
			code: 'export const url = "http://example.com/path";\nexport const s = "// Initialize";\n',
		},
		{
			name: "JSX text containing //",
			code: "export const el = <div>// Initialize the thing</div>;\n",
			fileExt: ".tsx",
		},
	];

	for (const tc of testCases) {
		it(`preserves byte identity for ${tc.name}`, async () => {
			const filename = `test${tc.fileExt ?? ".ts"}`;
			const filePath = writeFile(filename, tc.code);
			const ctx = makeContext([filePath]);

			// 1. Scan must produce NO comment findings inside template/string/JSX text
			const trivialDiags = await detectTrivialComments(ctx);
			const narrativeDiags = await detectNarrativeComments(ctx);
			const commentDiags = [...trivialDiags, ...narrativeDiags];

			expect(commentDiags).toHaveLength(0);

			// 2. Fix must leave the file byte-identical
			await fixNarrativeComments(ctx);
			const contentAfterFix = fs.readFileSync(filePath, "utf-8");
			expect(contentAfterFix).toBe(tc.code);
		});
	}

	it("positive control: real comments next to template literals are detected and removed", async () => {
		const codeWithRealComment = [
			"// Step 1: Initialize the thing",
			"export const tpl = `",
			"// Import nothing",
			'${"val"}',
			"`;",
		].join("\n");

		const filePath = writeFile("control.ts", codeWithRealComment);
		const ctx = makeContext([filePath]);

		// Real comment on line 1 should be detected
		const trivialDiags = await detectTrivialComments(ctx);
		const narrativeDiags = await detectNarrativeComments(ctx);
		const commentDiags = [...trivialDiags, ...narrativeDiags];

		expect(commentDiags.length).toBeGreaterThanOrEqual(1);
		expect(commentDiags.some((d) => d.line === 1)).toBe(true);
		// Line 3 (inside template) must NOT be reported
		expect(commentDiags.some((d) => d.line === 3)).toBe(false);

		// Fix must remove real comment on line 1 while preserving line 3 inside template
		await fixNarrativeComments(ctx);
		const contentAfter = fs.readFileSync(filePath, "utf-8");
		expect(contentAfter).not.toContain("// Step 1: Initialize the thing");
		expect(contentAfter).toContain("// Import nothing");
	});

	it("multiset invariant detects literal changes and prevents corruption", () => {
		const original = 'const x = `// Import nothing\\n${val}`;\nconst s = "hello";\n';
		const corrupted = 'const x = `\\n${val}`;\nconst s = "hello";\n';

		const origLiterals = extractStringAndTemplateLiterals(original, ".ts");
		const corruptLiterals = extractStringAndTemplateLiterals(corrupted, ".ts");

		expect(origLiterals).not.toEqual(corruptLiterals);
	});

	it("isCommentAtLine correctly identifies real comments vs strings/templates/JSX", () => {
		const source = [
			"// line 1: real comment",
			"const a = `",
			"// line 3: inside template",
			"`;",
			"const b = 'http://example.com';",
			"const c = <div>// inside JSX</div>;",
		].join("\n");

		expect(isCommentAtLine(source, ".tsx", 1)).toBe(true);
		expect(isCommentAtLine(source, ".tsx", 3)).toBe(false);
		expect(isCommentAtLine(source, ".tsx", 5)).toBe(false);
		expect(isCommentAtLine(source, ".tsx", 6)).toBe(false);
	});
});
