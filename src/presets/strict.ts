import type { Config } from "../config.ts";

const SIZE_LIMIT = "Size limits are a design conversation; fix only when asked.";

const strict: Config = {
  ignores: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "eslint.config.mjs",
  ],
  inlineConfig: false,
  comments: {
    allow: ["eslint", "global", "@ts-", "@vitest-environment", "prettier-ignore"],
  },
  env: {
    message:
      "Direct process.env access forbidden. Read deployment config through your environment module and pass it in",
  },
  limits: {
    params: 2,
    constructorParams: 10,
    functionLines: 50,
    fileLines: 250,
    componentLines: 600,
    complexity: 10,
    depth: 4,
    statements: 20,
    classesPerFile: 1,
    idLength: 2,
    magicNumbers: [0, 1, -1, 2],
  },
  tests: {
    moduleMocks: 3,
    spies: 5,
    globals: 2,
    nestedDescribe: 2,
    snapshotLines: 50,
    inlineSnapshotLines: 20,
    allowMocks: [],
  },
  tailwind: false,
  playwright: false,
  rules: {},
  mop: {
    fix: [
      "no-comments/disallowComments",
      "unicorn/no-nested-ternary",
      "sonarjs/no-nested-conditional",
      "sonarjs/no-unused-vars",
      "sonarjs/unused-import",
      "sonarjs/no-dead-store",
      "sonarjs/no-unused-collection",
      "@typescript-eslint/no-non-null-assertion",
      "unicorn/explicit-length-check",
      "unicorn/prefer-set-has",
      "unicorn/no-array-callback-reference",
      "unicorn/switch-case-braces",
      "unicorn/prefer-node-protocol",
      "unicorn/prefer-add-event-listener",
      "unicorn/prefer-top-level-await",
    ],
    leave: {
      "unicorn/filename-case": "PascalCase component files are the convention.",
      "unicorn/no-null": "Leave where the codebase uses null.",
      "unicorn/prevent-abbreviations": "Renames like ref to reference fight the codebase.",
      "unicorn/prefer-global-this": "window reads clearer in browser code.",
      "unicorn/no-array-sort": "Leave until the codebase uses toSorted.",
      "unicorn/prefer-iterator-to-array": "Leave until the codebase uses Iterator#toArray.",
      "max-lines-per-function": SIZE_LIMIT,
      "max-lines": SIZE_LIMIT,
      complexity: SIZE_LIMIT,
      "max-statements": SIZE_LIMIT,
    },
  },
};

export default strict;
