# mop

agents love making a mess, give yours a mop to clean up their slop.

New here? Read [How mop works](docs/how-mop-works.md). The [docs index](docs/README.md) lists every page.

## Install the plugin

```text
/plugin marketplace add zico-io/mop
/plugin install mop@zico-io
```

| Skill | Cleans |
|---|---|
| `/mop` | Everything the branch changed, routed by file type |
| `/mop:tests` | Test files: one test per behaviour, no service mocks |
| `/mop:code` | Code: `lint` findings on changed lines |
| `/mop:docs` | Markdown and MDX: doc lint and AI prose tells |
| `/mop:ui` | Components: Impeccable detector findings |
| `/mop:break` | Code: tries to break it, fixes what it can reproduce |

## `lint`

Lints only the lines a branch added, and tags each finding `fix`, `leave` or `review` from your config.

```bash
npx -y -p mop-harness lint                 # vs origin/HEAD
npx -y -p mop-harness lint --base main --json
npx -y -p mop-harness lint --base main --fix   # fix rules, branch lines only
npx -y -p mop-harness lint src/app.ts      # whole files
npx -y -p mop-harness lint --print-config
```

Exits 1 while `fix` findings remain. See the [`lint` reference](docs/reference/lint.md) and [troubleshooting](docs/troubleshooting.md).

## `judge`

Asks Jev, through one `jev batch` call, whether each finding should be enforced. Verdicts are `enforce`, `waive`, `human` (you decide) or `unjudged` (Jev unavailable). See the [`judge` reference](docs/reference/judge.md). Needs the `jev` CLI on the `PATH` with a key (`jev auth status`).

```bash
npx -y -p mop-harness lint --base main --json > findings.json
npx -y -p mop-harness judge --mop code findings.json
```

## Config

Four layers, last wins. Objects merge key by key; arrays replace.

| Layer | Where |
|---|---|
| Preset | `strict` ([src/presets/strict.ts](src/presets/strict.ts)) |
| Taste | `~/.config/mop/mop.config.{mjs,js,json}` |
| Org | whatever the repo config `extends` (a path or a package) |
| Repo | `mop.config.{mjs,js,json}` at the repo root |

```js title="mop.config.mjs"
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
    leave: { "unicorn/filename-case": "Next.js route files", "unicorn/no-null": null },
  },
};
```

The [mop.config reference](docs/reference/config.md) lists every key, its default and the merge rules.

Use the harness in your own `eslint.config.mjs` too (`pnpm add -D mop-harness`):

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

A change that should ship needs a changeset: run `pnpm changeset`, pick the bump, and commit the file it writes. On `main`, the release workflow opens a version PR that bumps `package.json` and the plugin manifests and writes `CHANGELOG.md`. Merging that PR publishes to npm through trusted publishing.

## Next steps

- [How mop works](docs/how-mop-works.md): the model behind the mops and the harness.
- [mop.config reference](docs/reference/config.md): every key and default.
- [Troubleshooting](docs/troubleshooting.md): errors and their fixes.
- [Contribute to mop](docs/contributing.md): change the harness or a mop.
