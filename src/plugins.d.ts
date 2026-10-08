declare module "eslint-plugin-better-max-params" {
  import type { ESLint } from "eslint";
  const plugin: ESLint.Plugin;
  export default plugin;
}

declare module "eslint-plugin-no-comments" {
  import type { ESLint } from "eslint";
  const plugin: ESLint.Plugin;
  export default plugin;
}

declare module "eslint-plugin-security" {
  import type { ESLint, Linter } from "eslint";
  const plugin: ESLint.Plugin & { configs: { recommended: Linter.Config } };
  export default plugin;
}
