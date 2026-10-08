import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { ESLint } from "eslint";
import { addedLines } from "../src/changes.ts";
import { harness, loadConfig, sortRule } from "../src/index.ts";

test("layers merge strict < user taste < org < repo", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mop-"));
  const user = path.join(dir, "user");
  const repo = path.join(dir, "repo");
  await Promise.all([mkdir(user), mkdir(repo)]);
  await writeFile(path.join(user, "mop.config.json"), JSON.stringify({ limits: { params: 4, depth: 6 } }));
  await writeFile(path.join(dir, "org.json"), JSON.stringify({ limits: { params: 3 }, mop: { leave: { "unicorn/no-null": null } } }));
  await writeFile(path.join(repo, "mop.config.json"), JSON.stringify({ extends: ["../org.json"], limits: { complexity: 15 } }));

  const config = await loadConfig({ cwd: repo, user });

  assert.deepEqual(
    [config.limits.params, config.limits.depth, config.limits.complexity, config.limits.fileLines],
    [3, 6, 15, 250],
  );
  assert.deepEqual(
    ["unicorn/no-null", "unicorn/filename-case", "unicorn/no-nested-ternary", "no-console"].map(
      (rule) => sortRule(config, rule).action,
    ),
    ["review", "leave", "fix", "review"],
  );
});

test("lints with the configured taste and reads added lines from a diff", async () => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: harness({ comments: { allow: ["ponytail:"] } }),
  });
  const code = "// ponytail: kept\n// dropped\nexport const pick = (a, b) => (a ? 'a' : b ? 'b' : 'c');\n";
  const results = await eslint.lintText(code, { filePath: "pick.mjs" });
  const rules = results.flatMap(({ messages }) => messages).map(({ ruleId, line }) => `${line}:${ruleId}`);

  assert.ok(rules.includes("2:no-comments/disallowComments"), rules.join(", "));
  assert.ok(!rules.includes("1:no-comments/disallowComments"), rules.join(", "));
  assert.ok(rules.includes("3:unicorn/no-nested-ternary"), rules.join(", "));
  assert.deepEqual([...addedLines("@@ -1,0 +4,2 @@\n+a\n+b\n@@ -9 +12 @@\n+c")], [4, 5, 12]);
});
