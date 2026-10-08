# mop

Slop mops for a branch. Each one finds the slop a branch added, fixes it on the lines the branch owns, and proves nothing broke.

| Skill | Cleans | Proof |
|---|---|---|
| `/mop` | Everything the branch changed, routed by file type | One typecheck and test run at the end |
| `/mop:tests` | Test files: one test per behaviour, no service mocks | Breaks the source and watches a remaining test fail |
| `/mop:code` | Code: `mop-lint` findings on changed lines, tuned by `mop.config` | Typecheck, tests, lint rerun |
| `/mop:docs` | Markdown and MDX: doc lint and AI prose tells | Doc linter at zero warnings |
| `/mop:ui` | Components: Impeccable detector findings | Detector rerun and a rendered check |

Every mop takes `[BASE_REF|path] [--no-commit]` and never pushes unless asked.

Depends on: Node 22+ for `mop-lint` (code, fetched with `npx` from this repo), pstack's `unslop` (docs), the `impeccable` plugin (ui).
