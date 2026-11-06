import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";
import { ESLint } from "eslint";
import { changedCode, CODE, git, resolveBase, type Lines, type Target } from "../src/changes";
import { commentFindings, lintLanguages } from "../src/languages";
import { harness, loadConfig, sortRule, type Sorting } from "../src";
import type { Finding } from "../src/judge";
import { record, runContext } from "../src/telemetry";

type LintFinding = Finding & Sorting & { file: string; line: number };

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: "string" },
    json: { type: "boolean" },
    fix: { type: "boolean" },
    "print-config": { type: "boolean" },
    run: { type: "string" },
  },
});

const started = performance.now();
const root = git(process.cwd(), "rev-parse", "--show-toplevel");
const config = await loadConfig({ cwd: root });

if (values["print-config"]) {
  console.log(JSON.stringify(config, undefined, 2));
  process.exit(0);
}

const base = positionals.length > 0 ? undefined : resolveBase(root, values.base);
const targets = base
  ? changedCode(root, base)
  : positionals.map((file): Target => ({ file: path.relative(root, path.resolve(file)), lines: "all" }));
const overrideConfig = harness(config);
const owns = (lines: Lines, line: number): boolean => lines === "all" || lines.has(line);

const lintTarget = async ({ file, lines }: Target): Promise<LintFinding[]> => {
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
      .map((message): LintFinding => ({
        file,
        line: message.line,
        rule: message.ruleId ?? (message.fatal ? "parse-error" : "eslint-directive"),
        message: message.message,
        ...sortRule(config, message.ruleId),
      })),
  );
};

const scripts = targets.filter(({ file }) => CODE.test(file));
const others = targets.filter(({ file }) => !CODE.test(file) && !config.ignores.some((glob) => path.matchesGlob(file, glob)));
const linesOf = new Map(others.map(({ file, lines }) => [file, lines]));
const languagesStarted = performance.now();
const { diagnostics, skipped } = lintLanguages(root, others.map(({ file }) => file), config.linters);
const languagesMs = performance.now() - languagesStarted;

const findings: LintFinding[] = [];
const eslintStarted = performance.now();
for (const target of scripts) findings.push(...(await lintTarget(target)));
const eslintMs = performance.now() - eslintStarted;
for (const diagnostic of [...diagnostics, ...others.flatMap(({ file }) => commentFindings(root, file, config.comments.allow))]) {
  const lines = linesOf.get(diagnostic.file);
  if (lines && owns(lines, diagnostic.line)) findings.push({ ...diagnostic, ...sortRule(config, diagnostic.rule) });
}

const byRule: Record<string, Pick<LintFinding, "action" | "reason"> & { count: number }> = {};
for (const { rule, action, reason } of findings) {
  byRule[rule] ??= { count: 0, action, reason };
  byRule[rule].count += 1;
}

const lineCount = ({ file, lines }: Target): number => {
  if (lines !== "all") return lines.size;
  try {
    return readFileSync(path.join(root, file), "utf8").split("\n").length;
  } catch {
    return 0;
  }
};
const byExt: Record<string, { files: number; lines: number; findings: number }> = {};
const extOf = (file: string): string => path.extname(file) || path.basename(file);
for (const target of targets) {
  const entry = (byExt[extOf(target.file)] ??= { files: 0, lines: 0, findings: 0 });
  entry.files += 1;
  entry.lines += lineCount(target);
}
for (const { file } of findings) {
  const entry = byExt[extOf(file)];
  if (entry) entry.findings += 1;
}

record({
  event: "lint",
  ...runContext(root, values.run),
  base,
  fix: Boolean(values.fix),
  files: targets.length,
  lines: Object.values(byExt).reduce((sum, { lines }) => sum + lines, 0),
  sources: config.sources,
  configHash: createHash("sha256").update(JSON.stringify(config)).digest("hex").slice(0, 12),
  skipped: skipped.map(({ language }) => language),
  durationMs: Math.round(performance.now() - started),
  phasesMs: { eslint: Math.round(eslintMs), languages: Math.round(languagesMs) },
  byExt,
  byRule,
  findings: findings.map(({ file, line, rule, action }) => ({ file, line, rule, action })),
});

if (values.json) {
  console.log(JSON.stringify({ base, sources: config.sources, files: targets.length, skipped, byRule, findings }, undefined, 2));
} else {
  const rows = Object.entries(byRule).sort(([, a], [, b]) => b.count - a.count);
  console.log(`${findings.length} findings in ${targets.length} files${base ? ` (lines added since ${base})` : ""}`);
  for (const [rule, { count, action, reason }] of rows) {
    console.log(`${String(count).padStart(5)}  ${action.padEnd(6)}  ${rule}${reason ? `  (${reason})` : ""}`);
  }
  for (const { language, reason } of skipped) console.log(`skipped ${language}: ${reason}`);
}

process.exitCode = findings.some((finding) => finding.action === "fix") ? 1 : 0;
