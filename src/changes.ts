import { execFileSync } from "node:child_process";

const CODE = /\.[cm]?[jt]sx?$/;
const HUNK = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/;

export type Lines = ReadonlySet<number> | "all";
export interface Target {
  file: string;
  lines: Lines;
}

export const git = (cwd: string, ...args: string[]): string => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

const refExists = (cwd: string, ref: string): boolean => {
  try {
    git(cwd, "rev-parse", "--verify", "--quiet", ref);
    return true;
  } catch {
    return false;
  }
};

export const resolveBase = (cwd: string, base?: string): string => {
  if (!base) return git(cwd, "symbolic-ref", "--short", "refs/remotes/origin/HEAD");
  return refExists(cwd, `origin/${base}`) ? `origin/${base}` : base;
};

export const addedLines = (diff: string): Set<number> => {
  const lines = new Set<number>();
  for (const line of diff.split("\n")) {
    const hunk = HUNK.exec(line);
    if (!hunk) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    for (let offset = 0; offset < count; offset += 1) lines.add(start + offset);
  }
  return lines;
};

// Compares the working tree with the merge base, so commits that land on the base later never count.
export const changedCode = (cwd: string, base: string): Target[] => {
  const mergeBase = git(cwd, "merge-base", base, "HEAD");
  const tracked = git(cwd, "diff", "--name-only", "--diff-filter=AM", mergeBase).split("\n");
  const untracked = git(cwd, "ls-files", "--others", "--exclude-standard").split("\n");
  return [...tracked, ...untracked]
    .filter((file) => CODE.test(file))
    .map((file): Target => ({
      file,
      lines: untracked.includes(file)
        ? "all"
        : addedLines(git(cwd, "diff", "-U0", mergeBase, "--", file)),
    }));
};
