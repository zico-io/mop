import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Linter } from "eslint";
import strict from "./presets/strict";

export interface Limits {
  params: number;
  constructorParams: number;
  functionLines: number;
  fileLines: number;
  componentLines: number;
  complexity: number;
  depth: number;
  statements: number;
  classesPerFile: number;
  idLength: number;
  magicNumbers: number[];
}

export interface TestLimits {
  moduleMocks: number;
  spies: number;
  globals: number;
  nestedDescribe: number;
  snapshotLines: number;
  inlineSnapshotLines: number;
  allowMocks: string[];
  internal?: string[];
}

export interface Config {
  ignores: string[];
  inlineConfig: boolean;
  comments: { allow: string[] };
  env: false | { message: string };
  limits: Limits;
  tests: TestLimits;
  tailwind: false | { entryPoint?: string; files?: string[] };
  playwright: false | { dir: string };
  rules: Linter.RulesRecord;
  linters: Record<"python" | "go" | "rust" | "terraform" | "yaml", false | string[]>;
  mop: { fix: string[]; leave: Record<string, string | null> };
}

type PartialValue<Value> = Value extends readonly unknown[]
  ? Value
  : Value extends object
    ? DeepPartial<Value>
    : Value;

export type DeepPartial<Shape> = { [Key in keyof Shape]?: PartialValue<Shape[Key]> };

export type UserConfig = DeepPartial<Config> & { extends?: (string | UserConfig)[] };

export type LoadedConfig = Config & { sources: string[] };

export type Sorting =
  | { action: "fix" | "review"; reason?: undefined }
  | { action: "leave"; reason: string };

type Plain = Record<string, unknown>;

const PRESETS: Record<string, Config> = { strict };
const FILES = ["mop.config.mjs", "mop.config.js", "mop.config.json"];

export const defineConfig = (config: UserConfig): UserConfig => config;

const isObject = (value: unknown): value is Plain =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const mergeLayers = (layers: readonly unknown[]): Plain =>
  layers.reduce<Plain>((merged, layer) => {
    for (const [key, value] of Object.entries(isObject(layer) ? layer : {})) {
      if (key === "extends" || value === undefined) continue;
      const current = merged[key];
      merged[key] = isObject(value) && isObject(current) ? mergeLayers([current, value]) : value;
    }
    return merged;
  }, {});

// Every layer is a partial of the base and arrays replace whole, so the result keeps the base's shape.
export const merge = <Shape extends object>(
  base: Shape,
  ...layers: readonly (DeepPartial<Shape> | undefined)[]
): Shape => mergeLayers([base, ...layers]) as Shape;

const loadFile = async (file: string): Promise<UserConfig> => {
  const config: UserConfig = file.endsWith(".json")
    ? JSON.parse(await readFile(file, "utf8"))
    : (await import(pathToFileURL(file).href)).default;
  return expand(config, path.dirname(file));
};

const resolveLayer = (spec: string | UserConfig, from: string): UserConfig | Promise<UserConfig> => {
  if (typeof spec !== "string") return expand(spec, from);
  const preset = PRESETS[spec];
  if (preset) return preset;
  const isPath = spec.startsWith(".") || path.isAbsolute(spec);
  return loadFile(
    isPath
      ? path.resolve(from, spec)
      : createRequire(path.join(from, "mop.config.mjs")).resolve(spec),
  );
};

async function expand(config: UserConfig, from: string): Promise<UserConfig> {
  const bases = await Promise.all((config.extends ?? []).map((spec) => resolveLayer(spec, from)));
  return merge<UserConfig>({}, ...bases, config);
}

const findIn = (directory: string): string | undefined =>
  FILES.map((name) => path.join(directory, name)).find((file) => existsSync(file));

export const userConfigDir = (): string =>
  path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"), "mop");

// ponytail: the strict preset is always the base, then taste, then the repo. Extends is for shared org configs.
export const loadConfig = async ({
  cwd = process.cwd(),
  user = userConfigDir(),
}: { cwd?: string; user?: string } = {}): Promise<LoadedConfig> => {
  const files = [findIn(user), findIn(cwd)].filter((file) => file !== undefined);
  const layers = await Promise.all(files.map(loadFile));
  return { ...merge<Config>(strict, ...layers), sources: files };
};

const matches = (pattern: string, ruleId: string | null): boolean =>
  pattern === ruleId || (pattern.endsWith("/*") && ruleId?.startsWith(pattern.slice(0, -1)) === true);

export const sortRule = (config: Pick<Config, "mop">, ruleId: string | null): Sorting => {
  const leave = Object.entries(config.mop.leave).find(
    ([pattern, reason]) => reason && matches(pattern, ruleId),
  );
  if (leave?.[1]) return { action: "leave", reason: leave[1] };
  const isFix = config.mop.fix.some((pattern) => matches(pattern, ruleId));
  return { action: isFix ? "fix" : "review" };
};
