export { default as harness } from "./harness.ts";
export { defineConfig, loadConfig, merge, sortRule, userConfigDir } from "./config.ts";
export type { Config, DeepPartial, Limits, LoadedConfig, Sorting, TestLimits, UserConfig } from "./config.ts";
export { default as strict } from "./presets/strict.ts";
