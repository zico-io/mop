# mop

Slop mops for Claude Code, and the strict ESLint harness behind them.

## Install the plugin

```
/plugin marketplace add zico-io/mop
/plugin install mop@zico-io
```

| Skill | Cleans |
|---|---|
| `/mop` | Everything the branch changed, routed by file type |
| `/mop:tests` | Test files: one test per behaviour, no service mocks |
| `/mop:code` | Code: `mop-lint` findings on changed lines |
| `/mop:docs` | Markdown and MDX: doc lint and AI prose tells |
| `/mop:ui` | Components: Impeccable detector findings |
| `/mop:break` | Code: tries to break it, fixes what it can reproduce |

## mop-lint

Lints only the lines a branch added, and tags each finding `fix`, `leave` or `review` from your config.

```bash
npx -y -p github:zico-io/mop mop-lint                 # vs origin/HEAD
npx -y -p github:zico-io/mop mop-lint --base main --json
npx -y -p github:zico-io/mop mop-lint --base main --fix   # fix rules, branch lines only
npx -y -p github:zico-io/mop mop-lint src/app.ts      # whole files
npx -y -p github:zico-io/mop mop-lint --print-config
```

Exits 1 while `fix` findings remain.

## mop-judge

Asks Jev, through one `jev batch` call, whether each finding should be enforced. Verdicts are `enforce`, `waive`, `human` (you decide) or `unjudged` (Jev unavailable). Needs the `jev` CLI on the `PATH` with a key (`jev auth status`).

```bash
npx -y -p github:zico-io/mop mop-lint --base main --json > findings.json
npx -y -p github:zico-io/mop mop-judge --mop code findings.json
```

## Config

Four layers, last wins. Objects merge key by key; arrays replace.

| Layer | Where |
|---|---|
| Preset | `strict` ([src/presets/strict.ts](src/presets/strict.ts)) |
| Taste | `~/.config/mop/mop.config.{mjs,js,json}` |
| Org | whatever the repo config `extends` (a path or a package) |
| Repo | `mop.config.{mjs,js,json}` at the repo root |

```js
// mop.config.mjs
export default {
  extends: ["@acme/mop-config"],
  comments: { allow: ["eslint", "@ts-", "ponytail:"] },
  limits: { params: 3, functionLines: 80, fileLines: 300 },
  tests: { moduleMocks: 2, allowMocks: ["^@acme/payments-sdk$"] },
  tailwind: { entryPoint: "src/app.css" },
  playwright: { dir: "e2e" },
  env: false,
  rules: { "unicorn/no-null": "off" },
  mop: {
    fix: ["no-comments/disallowComments", "unicorn/*"],
    leave: { "unicorn/filename-case": "Next.js route files", "unicorn/no-null": null },
  },
};
```

| Key | Controls |
|---|---|
| `ignores` | Globs never linted |
| `inlineConfig` | Whether `eslint-disable` comments work (strict: no) |
| `comments.allow` | Comment prefixes that survive the no-comments rule |
| `env` | The `process.env` ban and its message; `false` turns it off |
| `limits` | Params, function and file lines, complexity, depth, statements, id length, magic numbers |
| `tests` | Mock, spy and global budgets, allowed module mocks, describe depth, snapshot size |
| `tailwind`, `playwright` | Opt-in rule sets |
| `rules` | Raw ESLint overrides, applied last |
| `mop.fix`, `mop.leave` | How `/mop:code` sorts findings; `plugin/*` matches a whole plugin; `null` drops a `leave` |

Use the harness in your own `eslint.config.mjs` too (`npm i -D github:zico-io/mop`). pnpm blocks the build a git install runs until you add the `allowBuilds` entry its error prints, once per commit:

```js
import { harness, loadConfig } from "mop-harness";
export default harness(await loadConfig());
```

## Develop

```bash
pnpm install
pnpm typecheck
pnpm test
```
