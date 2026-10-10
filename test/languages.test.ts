import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { strict } from "../src";
import { commentFindings, LANGUAGES, languageOf } from "../src/languages";

test("flags full-line comments per language and keeps directives", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mop-"));
  await writeFile(path.join(root, "a.py"), "#!/usr/bin/env python\n# narrate\nx = 1  # trailing\n# noqa: E501\n");
  await writeFile(path.join(root, "a.go"), "//go:build linux\n// narrate\npackage a\n");
  await writeFile(path.join(root, "a.tf"), "# narrate\n// narrate\n# tflint-ignore: x\n");

  const lines = ["a.py", "a.go", "a.tf"].flatMap((file) =>
    commentFindings(root, file, strict.comments.allow).map(({ line }) => `${file}:${line}`),
  );

  assert.deepEqual(lines, ["a.py:2", "a.go:2", "a.tf:1", "a.tf:2"]);
  assert.deepEqual(["x.rs", "x.yml", "x.pyi", "x.ts", "x.md"].map(languageOf), ["rust", "yaml", "python", undefined, undefined]);
});

test("reads each linter's output into rule-prefixed diagnostics", () => {
  const outputs = {
    python: '[{"code":"F401","message":"unused","filename":"/r/a.py","location":{"row":3}}]',
    go: '{"code":"U1000","message":"unused","location":{"file":"/r/a.go","line":4}}\n',
    rust: [
      '{"reason":"compiler-artifact"}',
      '{"reason":"compiler-message","message":{"message":"unneeded return","code":{"code":"clippy::needless_return"},"spans":[{"file_name":"src/a.rs","line_start":3,"is_primary":true}]}}',
    ].join("\n"),
    terraform: '{"issues":[{"rule":{"name":"terraform_unused_declarations"},"message":"unused","range":{"filename":"a.tf","start":{"line":1}}}],"errors":[]}',
    yaml: "a.yaml:2:5: [error] too many spaces after colon (colons)\n",
  };

  const parsed = Object.entries(outputs).map(([name, stdout]) =>
    LANGUAGES[name as keyof typeof outputs].parse(stdout).map(({ file, line, rule }) => `${file}:${line}:${rule}`),
  );

  assert.deepEqual(parsed, [
    ["/r/a.py:3:ruff/F401"],
    ["/r/a.go:4:staticcheck/U1000"],
    ["src/a.rs:3:clippy/needless_return"],
    ["a.tf:1:tflint/terraform_unused_declarations"],
    ["a.yaml:2:yamllint/colons"],
  ]);
});
