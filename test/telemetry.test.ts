import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { collectGarbage, readEvents, record, summarize, telemetryFile } from "../src/telemetry";

test("records runs to the state dir and summarizes found, cleared and judged findings per rule", async () => {
  const env = { XDG_STATE_HOME: await mkdtemp(path.join(os.tmpdir(), "mop-telemetry-")) };
  const lint = (counts: Record<string, number>) => ({
    event: "lint" as const,
    run: "r1",
    durationMs: 100,
    byExt: { ".ts": { files: 1, lines: 10, findings: counts["no-comments"] ?? 0 } },
    byRule: Object.fromEntries(Object.entries(counts).map(([rule, count]) => [rule, { count, action: rule === "no-comments" ? "fix" : "review" }])),
  });
  record(lint({ "no-comments": 3, "id-length": 6 }), env);
  record({
    event: "judge",
    run: "r1",
    mop: "code",
    durationMs: 900,
    findings: Array.from({ length: 6 }, () => ({ file: "a.ts", line: 1, rule: "id-length", verdict: "waive" })),
  }, env);
  record(lint({ "id-length": 6 }), env);
  record({ event: "record", run: "r1", mop: "code", outcome: "done", fixed: 3, left: 6, human: 0 }, env);
  record({ event: "lint" }, { ...env, MOP_TELEMETRY: "0" });

  const file = telemetryFile(env) ?? "";
  const summary = summarize(readEvents(file));

  assert.equal(file, path.join(env.XDG_STATE_HOME, "mop", "runs.jsonl"));
  assert.equal(telemetryFile({ MOP_TELEMETRY: "0" }), undefined);
  assert.deepEqual(
    { runs: summary.runs, events: summary.events, medianMs: summary.medianMs, extensions: summary.extensions, outcomes: summary.outcomes },
    {
      runs: 1,
      events: { lint: 2, judge: 1, record: 1 },
      medianMs: { lint: 100, judge: 900 },
      extensions: { ".ts": { files: 1, lines: 10, findings: 3 } },
      outcomes: { code: { runs: 1, failed: 0, fixed: 3, left: 6, human: 0 } },
    },
  );
  assert.deepEqual(summary.rules, {
    "no-comments": { found: 3, fix: 3, leave: 0, review: 0, enforce: 0, waive: 0, human: 0, unjudged: 0, cleared: 3, suggest: undefined },
    "id-length": { found: 6, fix: 0, leave: 0, review: 6, enforce: 0, waive: 6, human: 0, unjudged: 0, cleared: 0, suggest: "mop.leave" },
  });
});

test("drops events older than 90 days", async () => {
  const file = path.join(await mkdtemp(path.join(os.tmpdir(), "mop-gc-")), "runs.jsonl");
  const day = 24 * 60 * 60 * 1000;
  const now = Date.parse("2026-11-05T00:00:00Z");
  const line = (daysAgo: number) => JSON.stringify({ v: 1, at: new Date(now - daysAgo * day).toISOString(), event: "lint" });
  await writeFile(file, [line(91), line(89), line(1)].map((entry) => `${entry}\n`).join(""));

  collectGarbage(file, now);

  assert.deepEqual(readEvents(file).map(({ at }) => at), [new Date(now - 89 * day).toISOString(), new Date(now - day).toISOString()]);
});
