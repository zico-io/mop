#!/usr/bin/env node
import path from "node:path";
import { parseArgs } from "node:util";
import { ESLint } from "eslint";
import { changedCode, git, resolveBase } from "../src/changes.mjs";
import { harness, loadConfig, sortRule } from "../src/index.mjs";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: "string" },
    json: { type: "boolean" },
    fix: { type: "boolean" },
    "print-config": { type: "boolean" },
  },
});

const root = git(process.cwd(), "rev-parse", "--show-toplevel");
const config = await loadConfig({ cwd: root });

if (values["print-config"]) {
  console.log(JSON.stringify(config, undefined, 2));
  process.exit(0);
}

const base = positionals.length > 0 ? undefined : resolveBase(root, values.base);
const targets = base
  ? changedCode(root, base)
  : positionals.map((file) => ({ file: path.relative(root, path.resolve(file)), lines: "all" }));
const overrideConfig = harness(config);
const owns = (lines, line) => lines === "all" || lines.has(line);

const lintTarget = async ({ file, lines }) => {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig,
    errorOnUnmatchedPattern: false,
    fix: values.fix && ((message) => sortRule(config, message.ruleId).action === "fix" && owns(lines, message.line)),
  });
  const results = await eslint.lintFiles([file]);
  if (values.fix) await ESLint.outputFixes(results);
  return results.flatMap((result) =>
    result.messages
      .filter((message) => owns(lines, message.line))
      .map((message) => ({
        file,
        line: message.line,
        rule: message.ruleId ?? "parse-error",
        message: message.message,
        ...sortRule(config, message.ruleId),
      })),
  );
};

const findings = [];
for (const target of targets) findings.push(...(await lintTarget(target)));

const byRule = {};
for (const { rule, action, reason } of findings) {
  byRule[rule] ??= { count: 0, action, reason };
  byRule[rule].count += 1;
}

if (values.json) {
  console.log(JSON.stringify({ base, sources: config.sources, files: targets.length, byRule, findings }, undefined, 2));
} else {
  const rows = Object.entries(byRule).sort(([, a], [, b]) => b.count - a.count);
  console.log(`${findings.length} findings in ${targets.length} files${base ? ` (lines added since ${base})` : ""}`);
  for (const [rule, { count, action, reason }] of rows) {
    console.log(`${String(count).padStart(5)}  ${action.padEnd(6)}  ${rule}${reason ? `  (${reason})` : ""}`);
  }
}

process.exitCode = findings.some((finding) => finding.action === "fix") ? 1 : 0;
