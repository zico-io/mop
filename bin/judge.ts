import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { text } from "node:stream/consumers";
import { parseArgs } from "node:util";
import { git } from "../src/changes";
import { loadConfig } from "../src/config";
import { decisionsRun, judge, modelOf, type Finding, type Judged } from "../src/judge";
import { record, runContext } from "../src/telemetry";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { json: { type: "boolean" }, mop: { type: "string" }, run: { type: "string" } },
});

const raw = positionals[0] ? await readFile(positionals[0], "utf8") : await text(process.stdin);
const input: Finding[] | { findings: Finding[] } = JSON.parse(raw);
const findings = (Array.isArray(input) ? input : input.findings).map((finding) => ({ mop: values.mop, ...finding }));
// `lint` writes paths from the git root, so snippets resolve from there too.
const repoRoot = (): string => {
  try {
    return git(process.cwd(), "rev-parse", "--show-toplevel");
  } catch {
    return process.cwd();
  }
};

const started = performance.now();
const root = repoRoot();
const config = await loadConfig({ cwd: root });
const enabled = process.env.MOP_JUDGE !== "0";
const judged: Judged<Finding>[] = enabled
  ? await judge(findings, { root, run: decisionsRun(config.judge, process.env) })
  : findings.map((finding) => ({ ...finding, verdict: "unjudged", why: "MOP_JUDGE=0" }));

const counts: Partial<Record<Judged<Finding>["verdict"], number>> = {};
for (const { verdict } of judged) counts[verdict] = (counts[verdict] ?? 0) + 1;
if (judged.length > 0 && counts.unjudged === judged.length) {
  console.error(`warning: none of the ${judged.length} findings were judged: ${judged[0]?.why}`);
}

record({
  event: "judge",
  ...runContext(process.cwd(), values.run),
  mop: values.mop ?? "code",
  judge: enabled && { provider: config.judge.provider, model: modelOf(config.judge) },
  durationMs: Math.round(performance.now() - started),
  counts,
  findings: judged.map((finding) => ({
    file: finding.file,
    line: finding.line,
    rule: finding.rule,
    verdict: finding.verdict,
    probabilities: "probabilities" in finding ? finding.probabilities : undefined,
  })),
});

if (values.json) {
  console.log(JSON.stringify({ counts, findings: judged }, undefined, 2));
} else {
  console.log(Object.entries(counts).map(([verdict, count]) => `${count} ${verdict}`).join(", ") || "0 findings");
  for (const finding of judged.filter(({ verdict }) => verdict === "human")) {
    console.log(`human  ${finding.file}:${finding.line}  ${finding.rule}  ${finding.why}`);
  }
}
