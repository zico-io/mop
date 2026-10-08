import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { judge, type JevResult, type JevRow } from "../src/judge";

const answer = (slop: number, deliberate: number, risky: number) => ({
  slop: { type: "noul", noul: slop },
  deliberate: { type: "noul", noul: deliberate },
  risky: { type: "noul", noul: risky },
});

test("sorts findings into enforce, waive and human, and never guesses when Jev fails", async () => {
  const replies: Record<string, Omit<JevResult, "id">> = {
    enforce: { answers: answer(0.97, 0.03, 0.04) },
    idiom: { answers: answer(0.04, 0.5, 0.5) },
    convention: { answers: answer(0.96, 0.95, 0.6) },
    risky: { answers: answer(0.98, 0.04, 0.95) },
    unsure: { answers: answer(0.6, 0.2, 0.1) },
  };
  const rules = [...Object.keys(replies), "down"];
  const run = async (rows: JevRow[]): Promise<JevResult[]> =>
    rows.map(({ id, state }) =>
      state.rule === "down" ? { id, error: "question failed" } : { id, ...replies[state.rule] },
    );
  const findings = rules.map((rule) => ({ rule, message: rule, snippet: "x" }));
  const judged = await judge(findings, { run });
  const outage = await judge(findings.slice(0, 1), { run: async () => { throw new Error("jev: not found"); } });
  assert.deepEqual(outage.map(({ verdict }) => verdict), ["unjudged"]);
  assert.deepEqual(
    judged.map(({ rule, verdict }) => [rule, verdict]),
    [
      ["enforce", "enforce"],
      ["idiom", "waive"],
      ["convention", "waive"],
      ["risky", "human"],
      ["unsure", "human"],
      ["down", "unjudged"],
    ],
  );
});

const FAKE_JEV = `#!/usr/bin/env node
let input = "";
process.stdin.on("data", (chunk) => (input += chunk)).on("end", () => {
  for (const line of input.split("\\n").filter(Boolean)) {
    const { id, state } = JSON.parse(line);
    console.log(JSON.stringify({ id, error: state.snippet }));
  }
});
`;

test("judge reads snippets from the git root when run from a subdirectory", async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), "mop-judge-"));
  const bin = path.join(repo, "bin");
  await Promise.all([mkdir(path.join(repo, "pkg")), mkdir(bin)]);
  await writeFile(path.join(repo, "pkg", "cart.ts"), "one\ntwo\nthree\n");
  await writeFile(path.join(bin, "jev"), FAKE_JEV);
  await chmod(path.join(bin, "jev"), 0o755);
  execFileSync("git", ["init", "-q"], { cwd: repo });
  const findings = JSON.stringify([{ file: "pkg/cart.ts", line: 2, rule: "r", message: "m" }]);

  const output = execFileSync(
    process.execPath,
    ["--import", import.meta.resolve("tsx"), path.resolve("bin/judge.ts"), "--json"],
    { cwd: path.join(repo, "pkg"), input: findings, encoding: "utf8", env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` } },
  );

  assert.equal(JSON.parse(output).findings[0].why, "  1 one\n> 2 two\n  3 three\n  4 ");
});
