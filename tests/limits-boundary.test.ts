import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkComplexity } from "../src/engines/code-quality/complexity.js";
import type { EngineContext } from "../src/engines/types.js";
import { exceedsLimit } from "../src/utils/limits.js";

let tmpDir: string;

const makeContext = (
	files: string[],
	qualityOverrides: Partial<EngineContext["config"]["quality"]> = {},
): EngineContext => ({
	rootDirectory: tmpDir,
	languages: ["typescript"],
	frameworks: ["none"],
	files,
	installedTools: {},
	config: {
		quality: {
			maxFunctionLoc: 80,
			maxFileLoc: 400,
			maxNesting: 5,
			maxParams: 6,
			...qualityOverrides,
		},
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

const makeLines = (count: number, line = "const x = 1;"): string =>
	Array(count).fill(line).join("\n");

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "raigal-limits-"));
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("Task 3: Complexity boundary limits with integer tolerance", () => {
	describe("exceedsLimit helper", () => {
		it("calculates integer tolerance Math.floor(max * multiplier * 110 / 100)", () => {
			// function: max 80, mult 1 -> limit 88
			expect(exceedsLimit(88, 80, 1)).toBe(false);
			expect(exceedsLimit(89, 80, 1)).toBe(true);

			// file: max 400, mult 1 -> limit 440
			expect(exceedsLimit(440, 400, 1)).toBe(false);
			expect(exceedsLimit(441, 400, 1)).toBe(true);

			// nesting: max 5, mult 1 -> limit 5
			expect(exceedsLimit(5, 5, 1)).toBe(false);
			expect(exceedsLimit(6, 5, 1)).toBe(true);

			// parameters: max 6, mult 1 -> limit 6
			expect(exceedsLimit(6, 6, 1)).toBe(false);
			expect(exceedsLimit(7, 6, 1)).toBe(true);

			// .tsx file: max 400, mult 2 -> limit 880
			expect(exceedsLimit(880, 400, 2)).toBe(false);
			expect(exceedsLimit(881, 400, 2)).toBe(true);

			// maxFunctionLoc 50 -> limit 55
			expect(exceedsLimit(55, 50, 1)).toBe(false);
			expect(exceedsLimit(56, 50, 1)).toBe(true);

			// maxFunctionLoc 10 -> limit 11
			expect(exceedsLimit(11, 10, 1)).toBe(false);
			expect(exceedsLimit(12, 10, 1)).toBe(true);
		});
	});

	describe("Engine boundary tests (pass then flag)", () => {
		it("file boundary: 440 passes, 441 flags", async () => {
			const passFile = writeFile("pass-440.ts", makeLines(440));
			const flagFile = writeFile("flag-441.ts", makeLines(441));

			const diagsPass = await checkComplexity(makeContext([passFile]));
			expect(diagsPass.filter((d) => d.rule === "complexity/file-too-large")).toHaveLength(0);

			const diagsFlag = await checkComplexity(makeContext([flagFile]));
			expect(diagsFlag.filter((d) => d.rule === "complexity/file-too-large")).toHaveLength(1);
		});

		it(".tsx file boundary: 880 passes, 881 flags", async () => {
			const passTsx = writeFile("pass-880.tsx", makeLines(880));
			const flagTsx = writeFile("flag-881.tsx", makeLines(881));

			const diagsPass = await checkComplexity(makeContext([passTsx]));
			expect(diagsPass.filter((d) => d.rule === "complexity/file-too-large")).toHaveLength(0);

			const diagsFlag = await checkComplexity(makeContext([flagTsx]));
			expect(diagsFlag.filter((d) => d.rule === "complexity/file-too-large")).toHaveLength(1);
		});

		it("function boundary (default 80): 88 passes, 89 flags", async () => {
			// function with total length 88: signature (1 line) + body (86 lines) + closing brace (1 line) = 88 lines
			const passBody = Array(86).fill("  const a = 1;").join("\n");
			const passFn = `function pass88() {\n${passBody}\n}`;
			const passFile = writeFile("pass-fn.ts", passFn);

			const diagsPass = await checkComplexity(makeContext([passFile]));
			expect(diagsPass.filter((d) => d.rule === "complexity/function-too-long")).toHaveLength(0);

			// function with total length 89: signature (1 line) + body (87 lines) + closing brace (1 line) = 89 lines
			const flagBody = Array(87).fill("  const a = 1;").join("\n");
			const flagFn = `function flag89() {\n${flagBody}\n}`;
			const flagFile = writeFile("flag-fn.ts", flagFn);

			const diagsFlag = await checkComplexity(makeContext([flagFile]));
			expect(diagsFlag.filter((d) => d.rule === "complexity/function-too-long")).toHaveLength(1);
		});

		it("function boundary with maxFunctionLoc 50: 55 passes, 56 flags", async () => {
			const passBody = Array(53).fill("  const a = 1;").join("\n");
			const passFn = `function pass55() {\n${passBody}\n}`;
			const passFile = writeFile("pass-55.ts", passFn);

			const diagsPass = await checkComplexity(makeContext([passFile], { maxFunctionLoc: 50 }));
			expect(diagsPass.filter((d) => d.rule === "complexity/function-too-long")).toHaveLength(0);

			const flagBody = Array(54).fill("  const a = 1;").join("\n");
			const flagFn = `function flag56() {\n${flagBody}\n}`;
			const flagFile = writeFile("flag-56.ts", flagFn);

			const diagsFlag = await checkComplexity(makeContext([flagFile], { maxFunctionLoc: 50 }));
			expect(diagsFlag.filter((d) => d.rule === "complexity/function-too-long")).toHaveLength(1);
		});

		it("function boundary with maxFunctionLoc 10: 11 passes, 12 flags", async () => {
			const passBody = Array(9).fill("  const a = 1;").join("\n");
			const passFn = `function pass11() {\n${passBody}\n}`;
			const passFile = writeFile("pass-11.ts", passFn);

			const diagsPass = await checkComplexity(makeContext([passFile], { maxFunctionLoc: 10 }));
			expect(diagsPass.filter((d) => d.rule === "complexity/function-too-long")).toHaveLength(0);

			const flagBody = Array(10).fill("  const a = 1;").join("\n");
			const flagFn = `function flag12() {\n${flagBody}\n}`;
			const flagFile = writeFile("flag-12.ts", flagFn);

			const diagsFlag = await checkComplexity(makeContext([flagFile], { maxFunctionLoc: 10 }));
			expect(diagsFlag.filter((d) => d.rule === "complexity/function-too-long")).toHaveLength(1);
		});

		it("nesting boundary (default 5): 5 passes, 6 flags", async () => {
			// Depth 5: 5 nested if statements
			const passContent = `function nest5(x: number) {
  if (x) {
    if (x) {
      if (x) {
        if (x) {
          if (x) {
            return x;
          }
        }
      }
    }
  }
  return 0;
}`;
			const passFile = writeFile("nest5.ts", passContent);
			const diagsPass = await checkComplexity(makeContext([passFile]));
			expect(diagsPass.filter((d) => d.rule === "complexity/deep-nesting")).toHaveLength(0);

			// Depth 6: 6 nested if statements
			const flagContent = `function nest6(x: number) {
  if (x) {
    if (x) {
      if (x) {
        if (x) {
          if (x) {
            if (x) {
              return x;
            }
          }
        }
      }
    }
  }
  return 0;
}`;
			const flagFile = writeFile("nest6.ts", flagContent);
			const diagsFlag = await checkComplexity(makeContext([flagFile]));
			expect(diagsFlag.filter((d) => d.rule === "complexity/deep-nesting")).toHaveLength(1);
		});

		it("parameters boundary (default 6): 6 passes, 7 flags", async () => {
			const passContent =
				"function p6(a: number, b: number, c: number, d: number, e: number, f: number) { return a; }";
			const passFile = writeFile("p6.ts", passContent);
			const diagsPass = await checkComplexity(makeContext([passFile]));
			expect(diagsPass.filter((d) => d.rule === "complexity/too-many-params")).toHaveLength(0);

			const flagContent =
				"function p7(a: number, b: number, c: number, d: number, e: number, f: number, g: number) { return a; }";
			const flagFile = writeFile("p7.ts", flagContent);
			const diagsFlag = await checkComplexity(makeContext([flagFile]));
			expect(diagsFlag.filter((d) => d.rule === "complexity/too-many-params")).toHaveLength(1);
		});
	});
});
