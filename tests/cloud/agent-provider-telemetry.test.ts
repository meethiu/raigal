import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CloudRunRecorder } from "../../src/cloud/recorder.js";
import { detectGitContext } from "../../src/cloud/context.js";
import { resolveProvider } from "../../src/agents/providers.js";

describe("Phase 1: Real Telemetry & Contract End-to-End", () => {
	it("records fake provider name, actual scores, and verbatim PR URL in cloud run payload", () => {
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "raigal-agent-telemetry-test-"));
		try {
			const recorder = new CloudRunRecorder("agent", tempDir);

			const fakeProvider = "test-provider-xyz";
			const measuredBeforeScore = 48;
			const measuredAfterScore = 93;
			const realPrUrl = "https://github.com/acme/widgets/pull/789";
			const realPatchDiff = "--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1 +1 @@\n-// bad\n+// good";

			recorder.setAgentTelemetry({
				provider: fakeProvider,
				before_score: measuredBeforeScore,
				after_score: measuredAfterScore,
				pr_url: realPrUrl,
				patch_diff: realPatchDiff,
				duration_ms: 4500,
			});

			recorder.setReport({
				score: measuredAfterScore,
				scoreable: true,
				files_scanned: 3,
				findings: [],
			});

			const payload = recorder.buildRunPayload(0);

			// Assert exact fake provider is preserved, not coerced to 'claude' or 'opencode'
			expect(payload.agent_telemetry).toBeDefined();
			expect(payload.agent_telemetry?.provider).toBe("test-provider-xyz");
			expect(payload.agent_telemetry?.before_score).toBe(48);
			expect(payload.agent_telemetry?.after_score).toBe(93);
			expect(payload.agent_telemetry?.pr_url).toBe("https://github.com/acme/widgets/pull/789");
			expect(payload.agent_telemetry?.patch_diff).toBe(realPatchDiff);

			// Also assert report.agent_telemetry mirrors it for backward compatibility
			expect(payload.report?.agent_telemetry?.provider).toBe("test-provider-xyz");
			expect(payload.report?.agent_telemetry?.before_score).toBe(48);
			expect(payload.report?.agent_telemetry?.after_score).toBe(93);
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("populates git.pr_number from GITHUB_EVENT_PATH fixture, never from local counter", () => {
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "raigal-git-event-test-"));
		const eventFile = path.join(tempDir, "event.json");
		const originalEventPath = process.env.GITHUB_EVENT_PATH;
		const originalPrRef = process.env.GITHUB_REF;

		try {
			delete process.env.GITHUB_REF;
			fs.writeFileSync(
				eventFile,
				JSON.stringify({
					pull_request: {
						number: 456,
						head: { sha: "abc1234567890def" },
						base: { ref: "feature-base" },
					},
				}),
			);
			process.env.GITHUB_EVENT_PATH = eventFile;

			const context = detectGitContext(tempDir);
			expect(context.pr_number).toBe(456);
			expect(context.head_sha).toBe("abc1234567890def");
			expect(context.base_ref).toBe("feature-base");
		} finally {
			if (originalEventPath !== undefined) {
				process.env.GITHUB_EVENT_PATH = originalEventPath;
			} else {
				delete process.env.GITHUB_EVENT_PATH;
			}
			if (originalPrRef !== undefined) {
				process.env.GITHUB_REF = originalPrRef;
			}
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("resolves arbitrary custom provider by binary name", () => {
		// Node binary is guaranteed to exist on path
		const status = resolveProvider(process.execPath);
		expect(status).not.toBeNull();
		expect(status?.provider.id).toBe(process.execPath);
	});
});
