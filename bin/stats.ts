import { parseArgs } from "node:util";
import { readEvents, summarize, telemetryFile } from "../src/telemetry";

const { values } = parseArgs({ options: { json: { type: "boolean" }, run: { type: "string" } } });

const file = telemetryFile();
if (!file) {
  console.log("telemetry is off (MOP_TELEMETRY=0)");
  process.exit(0);
}
const events = readEvents(file).filter(({ run }) => !values.run || run === values.run);
const summary = summarize(events);

if (values.json) {
  console.log(JSON.stringify(summary, undefined, 2));
  process.exit(0);
}

const seconds = (ms?: number): string => (ms === undefined ? "-" : `${(ms / 1000).toFixed(1)}s`);
const { lint, judge, record } = summary.events;
console.log(`${summary.runs} runs: ${lint} lint, ${judge} judge, ${record} record events in ${file}`);
console.log(`median lint ${seconds(summary.medianMs.lint)}, median judge ${seconds(summary.medianMs.judge)}`);

const columns = ["found", "fix", "leave", "review", "enforce", "waive", "human", "unjudged", "cleared"] as const;
console.log(`\n${columns.map((column) => column.padStart(8)).join(" ")}  rule`);
for (const [rule, stats] of Object.entries(summary.rules).sort(([, a], [, b]) => b.found - a.found)) {
  const hint = stats.suggest ? `  (consider ${stats.suggest})` : "";
  console.log(`${columns.map((column) => String(stats[column]).padStart(8)).join(" ")}  ${rule}${hint}`);
}

console.log("\n  files    lines findings  extension");
for (const [ext, { files, lines, findings }] of Object.entries(summary.extensions).sort(([, a], [, b]) => b.findings - a.findings)) {
  console.log(`${String(files).padStart(7)} ${String(lines).padStart(8)} ${String(findings).padStart(8)}  ${ext}`);
}

if (Object.keys(summary.outcomes).length > 0) console.log("\n   runs failed  fixed   left  human  mop");
for (const [mop, { runs, failed, fixed, left, human }] of Object.entries(summary.outcomes)) {
  console.log(`${[runs, failed, fixed, left, human].map((count) => String(count).padStart(7)).join("")}  ${mop}`);
}
