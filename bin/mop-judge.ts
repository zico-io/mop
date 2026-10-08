#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { text } from "node:stream/consumers";
import { parseArgs } from "node:util";
import { judge, type Finding, type Judged } from "../src/judge.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { json: { type: "boolean" }, mop: { type: "string" } },
});

const raw = positionals[0] ? await readFile(positionals[0], "utf8") : await text(process.stdin);
const input: Finding[] | { findings: Finding[] } = JSON.parse(raw);
const findings = (Array.isArray(input) ? input : input.findings).map((finding) => ({ mop: values.mop, ...finding }));
const judged: Judged<Finding>[] = process.env.JEV_ENABLED === "0"
  ? findings.map((finding) => ({ ...finding, verdict: "unjudged", why: "JEV_ENABLED=0" }))
  : await judge(findings);

const counts: Partial<Record<Judged<Finding>["verdict"], number>> = {};
for (const { verdict } of judged) counts[verdict] = (counts[verdict] ?? 0) + 1;

if (values.json) {
  console.log(JSON.stringify({ counts, findings: judged }, undefined, 2));
} else {
  console.log(Object.entries(counts).map(([verdict, count]) => `${count} ${verdict}`).join(", ") || "0 findings");
  for (const finding of judged.filter(({ verdict }) => verdict === "human")) {
    console.log(`human  ${finding.file}:${finding.line}  ${finding.rule}  ${finding.why}`);
  }
}
