import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

type Env = Record<string, string | undefined>;

export interface RunContext {
  run?: string;
  repo?: string;
  branch?: string;
  head?: string;
}

type EventName = "lint" | "judge" | "record";
type Action = "fix" | "leave" | "review";
type Verdict = "enforce" | "waive" | "human" | "unjudged";
type Extensions = Record<string, { files: number; lines: number; findings: number }>;

export type TelemetryEvent = RunContext & { event: EventName; mop?: string } & Record<string, unknown>;

export interface StoredEvent extends RunContext {
  v: 1;
  at: string;
  event: EventName;
  mop?: string;
  durationMs?: number;
  byRule?: Record<string, { count: number; action: Action }>;
  byExt?: Extensions;
  findings?: { rule: string; verdict?: Verdict }[];
  outcome?: string;
  fixed?: number;
  left?: number;
  human?: number;
}

type RuleStats = Record<Action | Verdict | "found" | "cleared", number> & { suggest?: string };

interface Outcome {
  runs: number;
  failed: number;
  fixed: number;
  left: number;
  human: number;
}

export interface Summary {
  runs: number;
  events: Record<EventName, number>;
  medianMs: { lint?: number; judge?: number };
  rules: Record<string, RuleStats>;
  extensions: Extensions;
  outcomes: Record<string, Outcome>;
}

const SUGGEST_MIN_JUDGED = 5;
const SUGGEST_SHARE = 0.8;
const RETAIN_MS = 90 * 24 * 60 * 60 * 1000;

export const telemetryFile = (env: Env = process.env): string | undefined =>
  env.MOP_TELEMETRY === "0"
    ? undefined
    : path.join(env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state"), "mop", "runs.jsonl");

export const runContext = (cwd: string, run?: string): RunContext => {
  const read = (...args: string[]): string | undefined => {
    try {
      return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined;
    } catch {
      return undefined;
    }
  };
  return { run, repo: read("rev-parse", "--show-toplevel"), branch: read("branch", "--show-current"), head: read("rev-parse", "--short", "HEAD") };
};

export const record = (event: TelemetryEvent, env: Env = process.env): string | undefined => {
  const file = telemetryFile(env);
  if (!file) return undefined;
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    collectGarbage(file);
    appendFileSync(file, `${JSON.stringify({ v: 1, at: new Date().toISOString(), ...event })}\n`);
    return file;
  } catch {
    return undefined;
  }
};

const isRecent = (line: string, cutoff: number): boolean => {
  try {
    return Date.parse(JSON.parse(line).at) >= cutoff;
  } catch {
    return false;
  }
};

export const collectGarbage = (file: string, now = Date.now()): void => {
  if (!existsSync(file)) return;
  const cutoff = now - RETAIN_MS;
  const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
  const [first] = lines;
  if (!first || isRecent(first, cutoff)) return;
  const kept = lines.filter((line) => isRecent(line, cutoff));
  writeFileSync(`${file}.tmp`, kept.map((line) => `${line}\n`).join(""));
  renameSync(`${file}.tmp`, file);
};

export const readEvents = (file: string): StoredEvent[] => {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .flatMap((line): StoredEvent[] => {
      try {
        return line ? [JSON.parse(line)] : [];
      } catch {
        return [];
      }
    });
};

const median = (values: number[]): number | undefined => {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const suggestion = (stats: RuleStats): string | undefined => {
  const judged = stats.enforce + stats.waive + stats.human;
  if (judged < SUGGEST_MIN_JUDGED) return undefined;
  if (stats.waive / judged >= SUGGEST_SHARE && stats.leave === 0) return "mop.leave";
  if (stats.enforce / judged >= SUGGEST_SHARE && stats.fix === 0) return "mop.fix";
  return undefined;
};

const lintsByRun = (lints: StoredEvent[]): (readonly [StoredEvent, StoredEvent])[] => {
  const groups = new Map<string, StoredEvent[]>();
  for (const [index, event] of lints.entries()) {
    const key = event.run ?? `#${index}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups.values()].flatMap((group) => {
    const [before] = group;
    const after = group.at(-1);
    return before && after ? [[before, after] as const] : [];
  });
};

const ruleStats = (lints: StoredEvent[], judges: StoredEvent[]): Summary["rules"] => {
  const rules: Summary["rules"] = {};
  const stats = (rule: string): RuleStats =>
    (rules[rule] ??= { found: 0, fix: 0, leave: 0, review: 0, enforce: 0, waive: 0, human: 0, unjudged: 0, cleared: 0 });
  for (const [before, after] of lintsByRun(lints)) {
    for (const [rule, { count, action }] of Object.entries(before.byRule ?? {})) {
      const entry = stats(rule);
      entry.found += count;
      entry[action] += count;
      entry.cleared += Math.max(0, count - (after.byRule?.[rule]?.count ?? 0));
    }
  }
  for (const { rule, verdict } of judges.flatMap(({ findings }) => findings ?? [])) {
    if (verdict) stats(rule)[verdict] += 1;
  }
  for (const entry of Object.values(rules)) entry.suggest = suggestion(entry);
  return rules;
};

const extensionTotals = (lints: StoredEvent[]): Extensions => {
  const extensions: Extensions = {};
  for (const [before] of lintsByRun(lints)) {
    for (const [extension, totals] of Object.entries(before.byExt ?? {})) {
      const entry = (extensions[extension] ??= { files: 0, lines: 0, findings: 0 });
      entry.files += totals.files;
      entry.lines += totals.lines;
      entry.findings += totals.findings;
    }
  }
  return extensions;
};

const outcomeTotals = (records: StoredEvent[]): Summary["outcomes"] => {
  const outcomes: Summary["outcomes"] = {};
  for (const event of records) {
    const entry = (outcomes[event.mop ?? "unknown"] ??= { runs: 0, failed: 0, fixed: 0, left: 0, human: 0 });
    entry.runs += 1;
    entry.failed += event.outcome === "failed" ? 1 : 0;
    entry.fixed += event.fixed ?? 0;
    entry.left += event.left ?? 0;
    entry.human += event.human ?? 0;
  }
  return outcomes;
};

const medianDuration = (events: StoredEvent[]): number | undefined =>
  median(events.flatMap(({ durationMs }) => (typeof durationMs === "number" ? [durationMs] : [])));

export const summarize = (events: StoredEvent[]): Summary => {
  const of = (name: EventName) => events.filter(({ event }) => event === name);
  const [lints, judges, records] = [of("lint"), of("judge"), of("record")];
  return {
    runs: new Set(events.map(({ run, at }) => run ?? at)).size,
    events: { lint: lints.length, judge: judges.length, record: records.length },
    medianMs: { lint: medianDuration(lints), judge: medianDuration(judges) },
    rules: ruleStats(lints, judges),
    extensions: extensionTotals(lints),
    outcomes: outcomeTotals(records),
  };
};
