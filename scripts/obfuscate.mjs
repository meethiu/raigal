#!/usr/bin/env node
/**
 * Post-build obfuscation pass for the raigal binary target.
 *
 * Reads dist/cli.js (produced by tsdown), applies javascript-obfuscator
 * with hardened settings, and writes dist/cli.obf.js ready for @yao-pkg/pkg.
 *
 * Settings used:
 *   - RC4-encrypted string array    - string literals replaced with encrypted decoder calls
 *   - Control flow flattening       - logic converted to a state machine
 *   - Dead code injection           - fake unreachable branches inserted
 *   - Identifier hex mangling       - all names become _0xABC1D2 style tokens
 *   - Self-defending                - throws if the output is reformatted/beautified
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const { default: JavaScriptObfuscator } = await import("javascript-obfuscator");

const inputPath = join(root, "dist", "cli.js");
const outputPath = join(root, "dist", "cli.obf.js");

const source = readFileSync(inputPath, "utf8");

// Strip existing shebang before obfuscating (we re-add it after)
const shebangMatch = source.match(/^#![^\n]*\n/);
const stripped = shebangMatch ? source.slice(shebangMatch[0].length) : source;

const inputKb = Math.round(Buffer.byteLength(source) / 1024);
console.log(`[obfuscate] Input:  dist/cli.js (${inputKb} KB)`);
console.log("[obfuscate] Applying obfuscation...");

const result = JavaScriptObfuscator.obfuscate(stripped, {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: "hexadecimal",
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.75,
  stringArrayEncoding: ["rc4"],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 3,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 5,
  stringArrayWrappersType: "function",
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
});

// Re-attach the shebang so the binary remains directly executable
const shebang = shebangMatch ? shebangMatch[0] : "#!/usr/bin/env node\n";
const obfuscated = shebang + result.getObfuscatedCode();

writeFileSync(outputPath, obfuscated, "utf8");

const outputKb = Math.round(Buffer.byteLength(obfuscated) / 1024);
console.log(`[obfuscate] Output: dist/cli.obf.js (${outputKb} KB)`);
console.log("[obfuscate] Done.");
