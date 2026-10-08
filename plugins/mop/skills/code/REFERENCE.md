# mop:code reference

## Config

mop-lint merges four layers, last wins:

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

Run `npx -y -p mop-harness mop-lint --print-config` to see the merged result and which files applied. The full default set is `src/presets/strict.ts` in the mop repo.

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

**Autofix output.** unicorn's fixes can produce `every((x) => !(x === y))`. Rewrite those to `every((x) => x !== y)`.
