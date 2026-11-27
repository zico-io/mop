import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { collectGarbage, findingIds, readEvents, record, summarize, telemetryFile, type Line } from "../src/telemetry";

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
      events: { lint: 2, judge: 1, record: 1, resolve: 0 },
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

test("full mode sends findings with their content and keeps the local file content-free", async () => {
  const env = { XDG_STATE_HOME: await mkdtemp(path.join(os.tmpdir(), "mop-full-")), MOP_TELEMETRY: "full" };
  const sent: Line[] = [];
  const send = async (line: Line) => {
    sent.push(line);
    return true;
  };
  const finding = { id: "0123456789abcdef", rule: "r", verdict: "human", message: "m", why: "w", snippet: "> 1 x" };

  record({ event: "judge", run: "r1", findings: [finding] }, env, send);
  record({ event: "judge", run: "r2", findings: [finding] }, { ...env, MOP_TELEMETRY: "1" }, send);

  assert.deepEqual(sent.map(({ run, findings }) => [run, findings]), [["r1", [finding]]]);
  assert.deepEqual(readEvents(telemetryFile(env) ?? "").map(({ findings }) => findings), [
    [{ id: finding.id, rule: "r", verdict: "human" }],
    [{ id: finding.id, rule: "r", verdict: "human" }],
  ]);
});

test("finding ids follow the flagged text, not its line number, and tell repeats apart", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mop-ids-"));
  await writeFile(path.join(root, "a.ts"), "x\nconsole.log(1)\nconsole.log(1)\n");
  const [first, second] = findingIds(root, [{ rule: "no-console", file: "a.ts", line: 2 }, { rule: "no-console", file: "a.ts", line: 3 }]);
  await writeFile(path.join(root, "a.ts"), "x\ny\nconsole.log(1)\n");
  const [moved] = findingIds(root, [{ rule: "no-console", file: "a.ts", line: 3 }]);

  assert.match(first ?? "", /^[\da-f]{16}$/);
  assert.notEqual(first, second);
  assert.equal(moved, first);
});

test("resolve records findings by id and rejects malformed input", async () => {
  const state = await mkdtemp(path.join(os.tmpdir(), "mop-resolve-"));
  const run = (...args: string[]) =>
    promisify(execFile)(process.execPath, ["--import", import.meta.resolve("tsx"), path.resolve("bin/slopmop.ts"), "resolve", ...args], {
      env: { ...process.env, XDG_STATE_HOME: state, MOP_TELEMETRY: "1" },
    });

  await run("--run", "r1", "--mop", "code", "0123456789abcdef=fixed", "fedcba9876543210=left");
  await assert.rejects(run("--run", "r1", "0123456789abcdef=maybe"), { code: 2 });
  await assert.rejects(run("0123456789abcdef=fixed"), { code: 2 });

  const [event] = readEvents(path.join(state, "mop", "runs.jsonl"));
  assert.deepEqual([event?.event, event?.run, event?.mop, event?.by, event?.resolutions], [
    "resolve",
    "r1",
    "code",
    "human",
    [{ id: "0123456789abcdef", resolution: "fixed" }, { id: "fedcba9876543210", resolution: "left" }],
  ]);
});
