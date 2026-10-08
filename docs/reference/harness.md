---
title: Harness API
description: The mop-harness exports, the rule sets harness() builds, and the test guardrail rules.
type: reference
updated: 2026-10-08
owner: zico-io
---

`mop-harness` exports the ESLint config that `mop-lint` runs, so your editor and CI can run the same rules.

```js title="eslint.config.mjs"
import { harness, loadConfig } from "mop-harness";

export default harness(await loadConfig());
```

Install it with `pnpm add -D mop-harness`. It needs Node 22 or later and ships ESLint 10, typescript-eslint and every plugin it uses as dependencies.

## `harness`

```ts
function harness(input?: UserConfig): Linter.Config[]
```

Returns a flat ESLint config. `input` merges onto the `strict` preset with the [config merge rules](config.md#merge-rules).

`harness()` does not read files and does not resolve `extends`. Pass the result of `loadConfig()` to get every layer.

### Rule sets

| Files | Rules |
| --- | --- |
| All source files | sonarjs, unicorn and security recommended |
| All source files | `no-comments/disallowComments`, the [`limits`](config.md#limits) rules, `no-console`, `eqeqeq`, the [`env`](config.md#env) ban |
| `*.jsx`, `*.tsx` | `@eslint-react` recommended-typescript |
| `*.tsx` | `max-lines` at `limits.componentLines` |
| [`tailwind.files`](config.md#tailwind) | Tailwind recommended, when `tailwind` is set |
| `<playwright.dir>/**/*.spec.ts` | Playwright recommended, when `playwright` is set |
| Fixtures, fakes, stubs and factories | Determinism syntax bans |
| Tests | The vitest rules, the test guardrails, the test syntax bans, the determinism bans, `no-non-null-assertion` |
| All source files | Your [`rules`](config.md#rules), last |

Source files are `**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}`. Tests are `**/*.{test,spec}.*` and `**/__tests__/**`. The parser is typescript-eslint, with Node and browser globals.

### Test guardrails

The harness registers the `test-guardrails` plugin for test files.

| Rule | Reports |
| --- | --- |
| `max-mocks-per-file` | `vi.mock`/`vi.doMock`, `vi.spyOn` and `vi.stubGlobal` calls past the [`tests`](config.md#tests) budgets |
| `no-internal-module-mock` | A `vi.mock` of a first-party module that `tests.allowMocks` does not list |
| `no-mock-subject-under-test` | A `vi.mock` of the module the test file is named after |
| `require-timer-restore` | `vi.useFakeTimers()` in a file with no `vi.useRealTimers()` |

### Syntax bans

Tests also fail on patterns that let a test pass without checking anything. Each message says what to write instead.

| Pattern | Example |
| --- | --- |
| Unawaited async assertion | `expect(p).resolves.toBe(1)` without `await` |
| Assertion that cannot fail | `expect(true).toBe(true)` |
| Inverted test | `test.fails(...)` |
| Whole-module stub | `vi.mock("./db")` with no factory, or a factory that returns `{}` |
| Mock in the wrong scope | `vi.mock` inside `it`, `describe` or a hook |
| Hollow mock | An empty `mockImplementation`, or a mock that returns `vi.fn()` |
| Real wait | `setTimeout`, `sleep`, `delay` |
| Leaky fake timers | `vi.useFakeTimers()` inside a test body |
| Nondeterminism | `Math.random()`, `crypto.randomUUID()`, `Date.now()`, `new Date()`, `vi.spyOn(Date, ...)` |

The nondeterminism bans also apply to fixture files.

## `loadConfig`

```ts
function loadConfig(options?: { cwd?: string; user?: string }): Promise<LoadedConfig>
```

Reads the taste file from `user` and the repo file from `cwd`, resolves `extends`, and merges both onto `strict`.

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `cwd` | `string` | `process.cwd()` | Directory that holds the repo `mop.config` |
| `user` | `string` | `userConfigDir()` | Directory that holds the taste `mop.config` |

Returns the full `Config` plus `sources`, the taste and repo files that loaded.

Throws when a config file has invalid JSON or syntax, or when an `extends` entry does not resolve.

## `defineConfig`

```ts
function defineConfig(config: UserConfig): UserConfig
```

Returns `config` unchanged. Use it in `mop.config.mjs` for type checking.

## `merge`

```ts
function merge<Shape extends object>(base: Shape, ...layers: (DeepPartial<Shape> | undefined)[]): Shape
```

Merges `layers` onto `base`: objects key by key, arrays whole. Skips `extends` keys and `undefined` values.

## `sortRule`

```ts
function sortRule(config: Pick<Config, "mop">, ruleId: string | null): Sorting
```

Returns `{ action: "leave", reason }` when a `mop.leave` pattern with a reason matches, else `{ action: "fix" }` when a `mop.fix` pattern matches, else `{ action: "review" }`.

## `userConfigDir`

```ts
function userConfigDir(): string
```

Returns `$XDG_CONFIG_HOME/mop`, or `~/.config/mop` when `XDG_CONFIG_HOME` is unset.

## `strict`

The default `Config`. Every layer merges onto it. See `src/presets/strict.ts` for every value.

## Types

| Type | Description |
| --- | --- |
| `Config` | The full, merged config. See [mop.config](config.md). |
| `UserConfig` | `DeepPartial<Config>` plus `extends`. The shape of a config file. |
| `LoadedConfig` | `Config` plus `sources: string[]`. |
| `Limits`, `TestLimits` | The `limits` and `tests` objects. |
| `Sorting` | `{ action: "fix" \| "review" }` or `{ action: "leave"; reason: string }`. |
| `DeepPartial<Shape>` | Every key optional, recursively. Arrays stay whole. |

## Don't

- Don't call `harness({ extends: [...] })`. `harness()` drops `extends`. Use `loadConfig()`.
- Don't add `eslint-disable` comments to silence a rule. `strict` ignores them. Set the rule in [`rules`](config.md#rules), or turn on [`inlineConfig`](config.md#inlineconfig).

## Next steps

- **Config keys**: every value `harness()` reads. [Learn more](config.md)
- **Lint a branch**: `mop-lint` runs this config on added lines. [Learn more](mop-lint.md)
- **Change a rule**: add or retune one in this repo. [Learn more](../contributing.md#change-the-harness)
- **Source**: the config builder. [Learn more](../../src/harness.ts)
