import { cpSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const plugin = path.resolve(import.meta.dirname, "../../../plugins/mop");
const out = path.resolve(import.meta.dirname, "../extension/skills");
const blob = "https://github.com/zico-io/mop/blob/main/plugins/mop";
const toGitHub = (_match: string, target: string): string => {
  const resolved = path.posix.normalize(`skills/${target}`);
  return `](${blob}/${resolved})`;
};

rmSync(out, { recursive: true, force: true });
cpSync(path.join(plugin, "skills"), out, { recursive: true });

const entries = readdirSync(out, { recursive: true, encoding: "utf8" });
for (const entry of entries) {
  if (!entry.endsWith(".md")) continue;
  const file = path.join(out, entry);
  const rewritten = readFileSync(file, "utf8")
    .replaceAll("](../../JUDGE.md", "](JUDGE.md")
    .replaceAll(/\]\(\.\.\/([^)]*)\)/g, toGitHub);
  writeFileSync(file, rewritten);
  if (rewritten.includes("](JUDGE.md")) cpSync(path.join(plugin, "JUDGE.md"), path.join(path.dirname(file), "JUDGE.md"));
}
