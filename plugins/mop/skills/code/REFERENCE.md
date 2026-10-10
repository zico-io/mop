# mop:code reference

## Config

`lint` merges four layers, last wins:

| Layer | Where | Use it for |
|---|---|---|
| Preset | `strict`, built into the harness | Defaults: rules, limits, the fix and leave sort |
| Taste | `~/.config/mop/mop.config.{mjs,js,json}` | Personal habits that follow you across repos |
| Org | anything a repo config `extends` (a path or package) | Shared team rules |
| Repo | `mop.config.{mjs,js,json}` at the repo root | This codebase's conventions |

Objects merge key by key; arrays replace. Set a `leave` entry to `null` to make that rule fixable again.

```js
// mop.config.mjs
export default {
  extends: ["@acme/mop-config"],
  comments: { allow: ["eslint", "@ts-", "ponytail:"] },
  limits: { params: 3, functionLines: 80 },
  tests: { moduleMocks: 2, allowMocks: ["^@acme/payments-sdk$"] },
  env: false,
  rules: { "unicorn/no-null": "off" },
  mop: { leave: { "unicorn/filename-case": "Next.js route files", "unicorn/no-null": null } },
};
```

Run `npx -y slopmop lint --print-config` to see the merged result and which files applied. The full default set is `src/presets/strict.ts` in the mop repo.

## Fix recipes

**Comments.** Strip only comments that start on a branch-added line. Keep comments that match the config's `comments.allow` prefixes; the strict preset keeps `eslint`, `global`, `@ts-`, `@vitest-environment` and `prettier-ignore`. A JSX comment takes its `{ }` with it. Removing a comment from an empty `catch {}` can eat its braces, so recheck with `prettier --check`.

**Nested ternaries.** Name the inner branch as a value, or use a small function with early returns, or a `switch` with braced cases.

```ts
// before
const label = done ? "Done" : failed ? "Failed" : "Running";
// after
const pending = failed ? "Failed" : "Running";
const label = done ? "Done" : pending;
```

**Comments in other languages.** `mop/no-comments` flags full-line `#` or `//` comments on added lines. Keep shebangs and tool directives (`# noqa`, `# type: ignore`, `//go:build`, `//nolint`, `# tflint-ignore`, `# yamllint`). A Rust `///` doc comment or a Go doc comment on an exported name is often the house style: let Jev weigh `deliberate`. A `#` line inside a Python string or YAML block scalar is data, not a comment; leave it.

**Python.** `F401` and `F841`: delete the unused import or variable, unless an `__init__.py` re-exports it (then add it to `__all__`). `ERA001`: delete the commented-out code. `T201`: replace `print` with the module's logger, or delete it. `RET505`: drop the `else` after `return` and dedent.

**Go.** `U1000`: delete the unused function, type or field, unless a build tag or `go:linkname` uses it. `S1008`: return the condition instead of `if c { return true }; return false`.

**Rust.** `needless_return`: make the last expression the value. `redundant_clone`: drop the `.clone()`. `unused_imports`, `unused_variables`, `dead_code`: delete; prefix with `_` only when a trait or callback signature needs the parameter.

**Terraform.** `terraform_unused_declarations`: delete the unused `variable`, `local` or `data` block, unless a module caller passes it.

**YAML.** Strip trailing spaces. Leave `truthy` keys like GitHub Actions' `on:` as they are.

**Autofix output.** unicorn's fixes can produce `every((x) => !(x === y))`. Rewrite those to `every((x) => x !== y)`.
