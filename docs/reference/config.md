---
title: mop.config
description: Every mop.config key, its type and strict default, and how the layers merge.
type: reference
updated: 2026-10-08
owner: zico-io
---

`mop.config` sets the harness rules and how the mops sort findings, per repo, per org and per person.

```js title="mop.config.mjs"
import { defineConfig } from "mop-harness";

export default defineConfig({
  extends: ["@acme/mop-config"],
  comments: { allow: ["eslint", "@ts-", "ponytail:"] },
  limits: { params: 3 },
  tests: { allowMocks: ["^@acme/payments-sdk$"] },
  mop: { leave: { "unicorn/no-null": null } },
});
```

## Files and layers

`loadConfig()` merges four layers onto each other. The last layer wins.

| Order | Layer | File |
| --- | --- | --- |
| 1 | Preset | `strict`, always the base (`src/presets/strict.ts`) |
| 2 | Taste | `mop.config.mjs`, `.js` or `.json` in `$XDG_CONFIG_HOME/mop`, else `~/.config/mop` |
| 3 | Org | Each entry in the `extends` array of the taste or repo file |
| 4 | Repo | `mop.config.mjs`, `.js` or `.json` at the git root |

In each directory, the first file found in the order `.mjs`, `.js`, `.json` is used. A `.mjs` or `.js` file default-exports the config.

### Merge rules

| Value | Merge |
| --- | --- |
| Object | Key by key, recursively |
| Array | The later layer replaces the whole array |
| `undefined` | Ignored, so the earlier value stays |
| `extends` | Never merged into the result |

### `extends`

An `extends` entry is one of:

| Entry | Resolves to |
| --- | --- |
| `"strict"` | The built-in preset |
| Starts with `.` or is absolute | A file, relative to the config that names it |
| Any other string | A package, resolved from the config's directory with Node's `require.resolve` |
| An object | An inline config, which can have its own `extends` |

Entries merge in array order, then the file that names them merges on top.

## Keys

All keys are optional. Defaults are the `strict` values.

### `ignores`

`string[]`. Globs that are never linted. Default: `**/node_modules/**`, `**/dist/**`, `**/build/**`, `**/coverage/**`, `eslint.config.mjs`.

### `inlineConfig`

`boolean`. When `false`, ESLint ignores `eslint-disable` and other inline config comments, and reports each one. Default: `false`.

### `comments.allow`

`string[]`. Regular expression fragments. A comment survives `no-comments/disallowComments` when its text, after at most one space, starts with a match. Default: `eslint`, `global`, `@ts-`, `@vitest-environment`, `prettier-ignore`. An empty array allows no comment.

### `env`

`false | { message: string }`. Bans `process.env` reads and `env` imports from `process` and `node:process`, with `message` as the error. `false` turns the ban off. Default: on, with a message that tells you to read config through an environment module.

### `limits`

| Key | Rule | Default |
| --- | --- | --- |
| `params` | `better-max-params/better-max-params` (functions) | `2` |
| `constructorParams` | `better-max-params/better-max-params` (constructors) | `10` |
| `functionLines` | `max-lines-per-function`, blank lines skipped | `50` |
| `fileLines` | `max-lines`, blank lines skipped | `250` |
| `componentLines` | `max-lines` for `.tsx` files | `600` |
| `complexity` | `complexity` | `10` |
| `depth` | `max-depth` | `4` |
| `statements` | `max-statements` | `20` |
| `classesPerFile` | `max-classes-per-file` | `1` |
| `idLength` | `id-length` minimum | `2` |
| `magicNumbers` | `no-magic-numbers` ignore list | `[0, 1, -1, 2]` |

### `tests`

Applies to `*.test.*`, `*.spec.*` and `__tests__/**` files.

| Key | Rule | Default |
| --- | --- | --- |
| `moduleMocks` | `test-guardrails/max-mocks-per-file`, `vi.mock` and `vi.doMock` calls | `3` |
| `spies` | `test-guardrails/max-mocks-per-file`, `vi.spyOn` calls | `5` |
| `globals` | `test-guardrails/max-mocks-per-file`, `vi.stubGlobal` calls | `2` |
| `nestedDescribe` | `vitest/max-nested-describe` | `2` |
| `snapshotLines` | `vitest/no-large-snapshots` | `50` |
| `inlineSnapshotLines` | `vitest/no-large-snapshots`, inline | `20` |
| `allowMocks` | Regular expressions for first-party modules that you can mock | `[]` |
| `internal` | Regular expressions that mark a module path as first-party | Relative paths, `@/`, `~/`, `#/`, `src/`, and workspace package names |

### `tailwind`

`false | { entryPoint?: string; files?: string[] }`. Turns on the Tailwind recommended rules. `entryPoint` is the CSS file the plugin reads, and `files` defaults to `**/*.{jsx,tsx}`. Default: `false`.

### `playwright`

`false | { dir: string }`. Turns on the Playwright recommended rules for `<dir>/**/*.spec.ts`, and turns off the vitest rules for those files. Default: `false`.

### `rules`

`Linter.RulesRecord`. Raw ESLint rule settings, applied last to every source file. Use it to turn a rule off or change its options. Default: `{}`.

### `mop.fix`

`string[]`. Rule ids that `lint` tags `fix` and `--fix` autofixes. A pattern is an exact rule id, or `plugin/*` for every rule of a plugin. Default: 15 rules, including `no-comments/disallowComments`, `unicorn/no-nested-ternary` and `@typescript-eslint/no-non-null-assertion`. See `src/presets/strict.ts`.

### `mop.leave`

`Record<string, string | null>`. Rule patterns that `lint` tags `leave`, each mapped to the reason. A `null` or empty reason drops the entry. `leave` wins over `fix`. Default: 10 entries, including `unicorn/filename-case`, `unicorn/no-null` and the four size rules.

A rule in neither list is tagged `review`.

## Don't

- Don't set `mop.fix`, `comments.allow` or `ignores` to add one item. Arrays replace, so your list drops every default. Copy the defaults from `lint --print-config` and add to them.
- Don't write `.` or `(` in `comments.allow` without a backslash. The entries are regular expressions.
- Don't put rules in your repo's `eslint.config.mjs` and expect `lint` to apply them. `lint` reads only `mop.config`.

## Next steps

- **Print the merged config**: `lint --print-config` shows the result and its `sources`. [Learn more](lint.md)
- **Use the config in ESLint**: `loadConfig()` and `harness()`. [Learn more](harness.md)
- **Why a rule fired**: common config mistakes. [Learn more](../troubleshooting.md)
- **The model**: how config, lint and judge fit. [Learn more](../how-mop-works.md)
