import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { inspect } from "../src/init";

test("inspect finds tailwind, playwright and an env module in tracked files only", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mop-init-"));
  await Promise.all(["apps/web/src", "apps/web/e2e", "dist"].map((dir) => mkdir(path.join(root, dir), { recursive: true })));
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ devDependencies: { "@playwright/test": "1" } }),
    "apps/web/package.json": JSON.stringify({ dependencies: { tailwindcss: "4" } }),
    "apps/web/src/app.css": '@import "tailwindcss";\n',
    "apps/web/src/env.ts": "export const env = {};\n",
    "apps/web/playwright.config.ts": "export default { testDir: './e2e' };\n",
    "dist/env.js": "",
  };
  await Promise.all(Object.entries(files).map(([file, body]) => writeFile(path.join(root, file), body)));
  await writeFile(path.join(root, ".gitignore"), "dist\n");
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });

  assert.deepEqual(inspect(root), {
    tailwind: { entryPoint: "apps/web/src/app.css" },
    playwright: { dir: "apps/web/e2e" },
    envModule: "apps/web/src/env.ts",
  });
});
