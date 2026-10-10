import { readFileSync } from "node:fs";
import path from "node:path";
import { git } from "./changes";

export interface Detected {
  tailwind?: { entryPoint?: string };
  playwright?: { dir: string };
  envModule?: string;
}

const TAILWIND_CSS = /@import\s+["']tailwindcss["']|@tailwind\s+base/;
const TEST_DIR = /testDir\s*:\s*["'`]([^"'`]+)["'`]/;
const ENV_MODULE = /(^|\/)env\.[cm]?[jt]s$/;
const PLAYWRIGHT_CONFIG = /(^|\/)playwright\.config\.[cm]?[jt]s$/;

const read = (root: string, file: string): string => readFileSync(path.join(root, file), "utf8");

const dependencies = (root: string, files: string[]): Set<string> => {
  const names = files
    .filter((file) => path.basename(file) === "package.json")
    .flatMap((file) => {
      const pkg = JSON.parse(read(root, file));
      return [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies].flatMap((deps) => Object.keys(deps ?? {}));
    });
  return new Set(names);
};

const playwrightDir = (root: string, files: string[]): string => {
  const config = files.find((file) => PLAYWRIGHT_CONFIG.test(file));
  if (!config) return "e2e";
  const testDir = TEST_DIR.exec(read(root, config))?.[1] ?? "tests";
  return path.posix.normalize(path.posix.join(path.posix.dirname(config), testDir));
};

export const inspect = (root: string): Detected => {
  const files = git(root, "ls-files").split("\n").filter(Boolean);
  const deps = dependencies(root, files);
  const detected: Detected = {};
  if (deps.has("tailwindcss")) {
    const entryPoint = files.find((file) => file.endsWith(".css") && TAILWIND_CSS.test(read(root, file)));
    detected.tailwind = entryPoint ? { entryPoint } : {};
  }
  if (deps.has("@playwright/test")) detected.playwright = { dir: playwrightDir(root, files) };
  const envModule = files.find((file) => ENV_MODULE.test(file));
  if (envModule) detected.envModule = envModule;
  return detected;
};
