import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearOutbox,
	enqueueRun,
	flushOutbox,
	getLastRecordedRun,
	loadOutboxRuns,
	MAX_OUTBOX_BYTES,
} from "../../src/cloud/outbox.js";
import type { RunType } from "../../src/cloud/types.js";

const createMockRun = (id: string, overrides: Partial<RunType> = {}): RunType => ({
	run_id: `123e4567-e89b-42d3-a456-${id.padStart(12, "0")}`,
	command: "scan",
	repo: {
		provider: "github",
		slug: "acme/repo",
	},
	owner_verified: false,
	git: {
		branch: "main",
	},
	flags: ["changes"],
	cli_version: "1.0.1",
	started_at: "2026-09-21T10:00:00.000Z",
	ended_at: "2026-09-21T10:00:05.000Z",
	exit_code: 0,
	steps: [{ seq: 0, name: "engine:ai-slop", ok: true, ms: 100 }],
	...overrides,
});

describe("outbox spooler and FIFO queue", () => {
	let tempDir: string;
	const originalStateDir = process.env.RAIGAL_STATE_DIR;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "raigal-outbox-test-"));
		process.env.RAIGAL_STATE_DIR = tempDir;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		delete process.env.RAIGAL_MAX_OUTBOX_BYTES;
		if (originalStateDir !== undefined) {
			process.env.RAIGAL_STATE_DIR = originalStateDir;
		} else {
			delete process.env.RAIGAL_STATE_DIR;
		}
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	it("enqueues runs in FIFO order and returns last recorded run", () => {
		const run1 = createMockRun("1");
		const run2 = createMockRun("2");

		enqueueRun(run1);
		enqueueRun(run2);

		const loaded = loadOutboxRuns();
		expect(loaded).toHaveLength(2);
		expect(loaded[0]?.run_id).toBe(run1.run_id);
		expect(loaded[1]?.run_id).toBe(run2.run_id);

		const last = getLastRecordedRun();
		expect(last?.run_id).toBe(run2.run_id);
	});

	it("flushes runs successfully via API", async () => {
		const run1 = createMockRun("1");
		const run2 = createMockRun("2");
		enqueueRun(run1);
		enqueueRun(run2);

		const postedRuns: unknown[] = [];
		const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
			if (init?.body) {
				postedRuns.push(JSON.parse(String(init.body)));
			}
			return new Response(JSON.stringify({ ok: true }), { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await flushOutbox("rgl_live_test_token");
		expect(result.sent).toBe(2);
		expect(result.failed).toBe(0);
		expect(result.remaining).toBe(0);
		expect(postedRuns).toHaveLength(2);

		expect(loadOutboxRuns()).toHaveLength(0);
	});

	it("handles 409 Conflict idempotently without failing", async () => {
		const run = createMockRun("1");
		enqueueRun(run);

		const fetchMock = vi.fn(async () =>
			new Response(JSON.stringify({ error: "conflict_already_recorded" }), { status: 409 }),
		);
		vi.stubGlobal("fetch", fetchMock);

		const result = await flushOutbox("rgl_live_token");
		expect(result.sent).toBe(1);
		expect(result.remaining).toBe(0);
		expect(loadOutboxRuns()).toHaveLength(0);
	});

	it("stops flushing on network error and preserves remaining runs", async () => {
		const run1 = createMockRun("1");
		const run2 = createMockRun("2");
		enqueueRun(run1);
		enqueueRun(run2);

		let callCount = 0;
		const fetchMock = vi.fn(async () => {
			callCount++;
			if (callCount === 1) {
				return new Response(JSON.stringify({ ok: true }), { status: 200 });
			}
			throw new Error("Network unreachable");
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await flushOutbox("rgl_live_token");
		expect(result.sent).toBe(1);
		expect(result.failed).toBe(1);
		expect(result.remaining).toBe(1);

		const remaining = loadOutboxRuns();
		expect(remaining).toHaveLength(1);
		expect(remaining[0]?.run_id).toBe(run2.run_id);
	});

	it("drops oldest runs when outbox exceeds cap", () => {
		process.env.RAIGAL_MAX_OUTBOX_BYTES = "800";

		const firstRun = createMockRun("1");
		enqueueRun(firstRun);
		enqueueRun(createMockRun("2"));
		enqueueRun(createMockRun("3"));
		enqueueRun(createMockRun("4"));

		const outboxPath = path.join(tempDir, "outbox.jsonl");
		const stat = fs.statSync(outboxPath);
		expect(stat.size).toBeLessThanOrEqual(800);

		// Verify oldest run (run 1) was evicted
		const runs = loadOutboxRuns();
		const ids = runs.map((r) => r.run_id);
		expect(ids).not.toContain(firstRun.run_id);
		expect(ids).toContain(createMockRun("4").run_id);
	});
});
