import eslintReact from "@eslint-react/eslint-plugin";
import vitest from "@vitest/eslint-plugin";
import { defineConfig } from "eslint/config";
import betterMaxParams from "eslint-plugin-better-max-params";
import noComments from "eslint-plugin-no-comments";
import playwright from "eslint-plugin-playwright";
import security from "eslint-plugin-security";
import { configs as sonarjsConfigs } from "eslint-plugin-sonarjs";
import tailwindcss from "eslint-plugin-tailwindcss";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";
import tseslint from "typescript-eslint";
import type { Linter } from "eslint";
import strict from "./presets/strict";
import { merge, type Config, type Limits, type TestLimits, type UserConfig } from "./config";
import testGuardrails from "./rules/test-guardrails";
import { DETERMINISM_SYNTAX, FIXTURE_FILES, TEST_FILES, TEST_SYNTAX } from "./rules/test-syntax";

const SOURCE = "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}";

type RestrictedSyntax = { selector: string; message: string };

// Typed as a typescript-eslint FlatConfig or an array, which Linter.Config rejects; at runtime it is one plain config object.
const tailwindRecommended = tailwindcss.configs.recommended as Linter.Config;

const envSyntax = (env: Config["env"]): RestrictedSyntax[] =>
  env
    ? [
        "MemberExpression[object.name='process'][property.name='env']",
        "MemberExpression[object.name='process'][property.value='env']",
        "MemberExpression[object.property.name='process'][property.name='env']",
        "VariableDeclarator[init.name='process'] > ObjectPattern > Property[key.name='env']",
      ].map((selector) => ({ selector, message: env.message }))
    : [];

const envImports = (env: Config["env"]) =>
  env
    ? ["node:process", "process"].map((name) => ({
        name,
        importNames: ["env", "default"],
        message: env.message,
      }))
    : [];

const sizeRules = (limits: Limits): Linter.RulesRecord => ({
  "better-max-params/better-max-params": [
    "error",
    { constructor: limits.constructorParams, func: limits.params },
  ],
  "max-lines-per-function": ["error", { max: limits.functionLines, skipBlankLines: true }],
  "max-lines": ["error", { max: limits.fileLines, skipBlankLines: true }],
  "no-magic-numbers": [
    "error",
    { detectObjects: false, enforceConst: true, ignore: limits.magicNumbers, ignoreArrayIndexes: true },
  ],
  complexity: ["error", limits.complexity],
  "max-depth": ["error", limits.depth],
  "max-statements": ["error", limits.statements],
  "max-classes-per-file": ["error", limits.classesPerFile],
  "id-length": ["error", { min: limits.idLength }],
});

const testRules = (tests: TestLimits, restrictedSyntax: RestrictedSyntax[]): Linter.RulesRecord => ({
  "no-restricted-syntax": ["error", ...restrictedSyntax, ...DETERMINISM_SYNTAX, ...TEST_SYNTAX],
  "test-guardrails/max-mocks-per-file": [
    "error",
    { moduleMocks: tests.moduleMocks, spies: tests.spies, globals: tests.globals },
  ],
  "test-guardrails/no-internal-module-mock": [
    "error",
    { allow: tests.allowMocks, ...(tests.internal && { internal: tests.internal }) },
  ],
  "test-guardrails/no-mock-subject-under-test": "error",
  "test-guardrails/require-timer-restore": "error",
  "vitest/expect-expect": ["error", { assertFunctionNames: ["expect", "expect*", "assert*"] }],
  "vitest/hoisted-apis-on-top": "error",
  "vitest/max-nested-describe": ["error", { max: tests.nestedDescribe }],
  "vitest/no-commented-out-tests": "error",
  "vitest/no-conditional-expect": "error",
  "vitest/no-conditional-in-test": "error",
  "vitest/no-conditional-tests": "error",
  "vitest/no-disabled-tests": "error",
  "vitest/no-done-callback": "error",
  "vitest/no-focused-tests": "error",
  "vitest/no-identical-title": "error",
  "vitest/no-interpolation-in-snapshots": "error",
  "vitest/no-large-snapshots": [
    "error",
    { maxSize: tests.snapshotLines, inlineMaxSize: tests.inlineSnapshotLines },
  ],
  "vitest/no-mocks-import": "error",
  "vitest/no-restricted-vi-methods": [
    "error",
    {
      importMock:
        "vi.importMock() auto-mocks the whole module. Import the real module and spy on one boundary function.",
    },
  ],
  "vitest/no-test-prefixes": "error",
  "vitest/no-test-return-statement": "error",
  "vitest/prefer-called-with": "error",
  "vitest/prefer-import-in-mock": "error",
  "vitest/prefer-vi-mocked": "error",
  "vitest/require-awaited-expect-poll": "error",
  "vitest/require-to-throw-message": "error",
  "vitest/valid-describe-callback": "error",
  "vitest/valid-expect": "error",
  "vitest/valid-expect-in-promise": "error",
  "vitest/valid-title": "error",
  "@typescript-eslint/no-non-null-assertion": "error",
});

export default function harness(input: UserConfig = {}): Linter.Config[] {
  const config = merge<Config>(strict, input);
  const restrictedSyntax = envSyntax(config.env);
  const playwrightFiles = config.playwright ? [`${config.playwright.dir}/**/*.spec.ts`] : [];
  return defineConfig([
    { ignores: config.ignores },
    {
      files: [SOURCE],
      languageOptions: { parser: tseslint.parser, globals: { ...globals.node, ...globals.browser } },
      linterOptions: { noInlineConfig: !config.inlineConfig },
    },
    sonarjsConfigs.recommended,
    unicorn.configs.recommended,
    security.configs.recommended,
    { files: ["**/*.{jsx,tsx}"], ...eslintReact.configs["recommended-typescript"] },
    ...(config.tailwind
      ? [
          {
            ...tailwindRecommended,
            files: config.tailwind.files ?? ["**/*.{jsx,tsx}"],
            settings: { tailwindcss: { cssConfigPath: config.tailwind.entryPoint } },
          },
        ]
      : []),
    ...(playwrightFiles.length
      ? [{ ...playwright.configs["flat/recommended"], files: playwrightFiles }]
      : []),
    {
      files: [SOURCE],
      plugins: { "better-max-params": betterMaxParams, "no-comments": noComments },
      rules: {
        "no-comments/disallowComments": [
          "error",
          { allow: config.comments.allow.length ? config.comments.allow : ["(?!)"] },
        ],
        ...sizeRules(config.limits),
        "no-console": "error",
        eqeqeq: ["error", "always"],
        "no-restricted-syntax": ["error", ...restrictedSyntax],
        "no-restricted-imports": ["error", ...envImports(config.env)],
      },
    },
    {
      files: ["**/*.tsx"],
      rules: { "max-lines": ["error", { max: config.limits.componentLines, skipBlankLines: true }] },
    },
    {
      files: FIXTURE_FILES,
      ignores: TEST_FILES,
      rules: { "no-restricted-syntax": ["error", ...restrictedSyntax, ...DETERMINISM_SYNTAX] },
    },
    {
      files: TEST_FILES,
      ignores: playwrightFiles,
      plugins: { vitest, "test-guardrails": testGuardrails, "@typescript-eslint": tseslint.plugin },
      rules: testRules(config.tests, restrictedSyntax),
    },
    { files: [SOURCE], rules: config.rules },
  ]);
}
