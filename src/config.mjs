import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import strict from "./presets/strict.mjs";

const PRESETS = { strict };
const FILES = ["mop.config.mjs", "mop.config.js", "mop.config.json"];

export const defineConfig = (config) => config;

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const merge = (...layers) =>
  layers.reduce((merged, layer) => {
    for (const [key, value] of Object.entries(layer ?? {})) {
      if (key === "extends" || value === undefined) continue;
      merged[key] =
        isObject(value) && isObject(merged[key]) ? merge(merged[key], value) : value;
    }
    return merged;
  }, {});

const loadFile = async (file) => {
  const config = file.endsWith(".json")
    ? JSON.parse(await readFile(file, "utf8"))
    : (await import(pathToFileURL(file).href)).default;
  return expand(config, path.dirname(file));
};

const resolveLayer = (spec, from) => {
  if (isObject(spec)) return expand(spec, from);
  if (PRESETS[spec]) return PRESETS[spec];
  const isPath = spec.startsWith(".") || path.isAbsolute(spec);
  return loadFile(
    isPath
      ? path.resolve(from, spec)
      : createRequire(path.join(from, "mop.config.mjs")).resolve(spec),
  );
};

async function expand(config, from) {
  const bases = await Promise.all(
    (config.extends ?? []).map((spec) => resolveLayer(spec, from)),
  );
  return merge(...bases, config);
}

const findIn = (directory) =>
  FILES.map((name) => path.join(directory, name)).find((file) => existsSync(file));

export const userConfigDir = () =>
  path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"), "mop");

// ponytail: the strict preset is always the base, then taste, then the repo. Extends is for shared org configs.
export const loadConfig = async ({ cwd = process.cwd(), user = userConfigDir() } = {}) => {
  const files = [findIn(user), findIn(cwd)].filter(Boolean);
  const layers = await Promise.all(files.map(loadFile));
  return { ...merge(strict, ...layers), sources: files };
};

const matches = (pattern, ruleId) =>
  pattern === ruleId || (pattern.endsWith("/*") && ruleId?.startsWith(pattern.slice(0, -1)));

export const sortRule = (config, ruleId) => {
  const leave = Object.entries(config.mop?.leave ?? {}).find(
    ([pattern, reason]) => reason && matches(pattern, ruleId),
  );
  if (leave) return { action: "leave", reason: leave[1] };
  const isFix = (config.mop?.fix ?? []).some((pattern) => matches(pattern, ruleId));
  return { action: isFix ? "fix" : "review" };
};
