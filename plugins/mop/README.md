# mop

Slop mops for a branch. Each one finds the slop a branch added, fixes it on the lines the branch owns, and proves nothing broke.

| Skill | Cleans | Proof |
|---|---|---|
| `/mop` | Everything the branch changed, routed by file type | One typecheck and test run at the end |
| `/mop:tests` | Test files: one test per behaviour, no service mocks | Breaks the source and watches a remaining test fail |
| `/mop:code` | Code (JS, TS, Python, Go, Rust, Terraform, YAML): `lint` findings on changed lines, tuned by `mop.config` | Typecheck, tests, lint rerun |
| `/mop:docs` | Markdown and MDX: doc lint and AI prose tells | Doc linter at zero warnings |
| `/mop:ui` | Components: Impeccable detector findings | Detector rerun and a rendered check |
| `/mop:break` | Code: adversarial attacks on inputs, state, failure paths and contracts | A reproduction per hole, and a regression test that fails without each fix |

Every mop takes `[BASE_REF|path] [--no-commit]` and never pushes unless asked.

Every slop mop asks Jev which findings to enforce and hands the uncertain ones to you under **Needs your call**; see [JUDGE.md](JUDGE.md). `/mop:break` reports only holes it can reproduce and hands you the ones that are product calls.

Depends on: Node 22+ for `lint` and `judge` (the `slopmop` package on npm, run with `npx`), and for each non-JS language its linter on `PATH` (`ruff`, `staticcheck`, `cargo clippy`, `tflint`, `yamllint`), pstack's `unslop` (docs), the `impeccable` plugin (ui). Judging needs the `jev` CLI with a key; without it, the mops fall back to their own sort.
