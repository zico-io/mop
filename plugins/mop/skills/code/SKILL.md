---
name: code
description: "Slop mop for code: lints a branch's changed lines with `lint` (a strict ESLint harness tuned per repo, org and taste through mop.config files), and Python, Go, Rust, Terraform and YAML with ruff, staticcheck, clippy, tflint and yamllint, then fixes the findings that are real slop (comments the branch added, nested ternaries, dead code, non-null assertions, implicit length checks, array lookups that should be Sets) and leaves the ones the config marks as fighting the repo's conventions, with typecheck and tests as proof. Use when the user says code slop, harness lint, de-slop the code, lint my changes, strip the comments I added, or /mop:code. Not for over-engineering review (use /ponytail-review) or bugs (use /code-review). Usage - /mop:code, /mop:code main, /mop:code packages/api --no-commit"
---

Fix the slop the branch added to its code, on the lines it owns.

**Arguments:** `$ARGUMENTS`
- `BASE_REF`: the name of the branch the PR targets, without `origin/`. Default: the open PR's base, else the repo's default branch. Or a path to lint everything under it.
- `--no-commit`: stop after verification.

## Steps

1. **Lint changed lines.** From the repo root:
   ```bash
   npx -y slopmop lint --base "$BASE_REF" --json > /tmp/mop-findings.json
   ```
   Pass paths instead of `--base` to lint whole files. `lint` compares the working tree with the merge base, keeps only findings on lines the branch added, and tags each one `fix`, `leave` (with the reason) or `review` from the merged config. Report `byRule` counts, `sources` (which config files applied) and `skipped` (languages whose linter is not installed).

2. **Sort.** `fix` and `leave` come from the config; see [REFERENCE.md](REFERENCE.md#config) for how layers merge. `leave` is final.

3. **Judge.** Send every `fix` and `review` finding to Jev with `--mop code`, following [JUDGE.md](../../JUDGE.md). Fix only `enforce`; `waive` joins the left list; `human` goes to **Needs your call**. If Jev is skipped, fix `fix` findings and decide each `review` rule yourself. Show the split and wait for a go-ahead when it is over about 100 fixes.

4. **Fix** the `enforce` findings with the recipes in [REFERENCE.md](REFERENCE.md#fix-recipes). `npx -y slopmop lint --base "$BASE_REF" --fix` autofixes every `fix` rule in JS and TS on lines the branch added, so revert any autofix on a `waive` or `human` finding; review the result. Fix the other languages by hand. Recheck every edited JS or TS file with `prettier --check`, and every other file with its formatter (`ruff format --check`, `gofmt -l`, `cargo fmt --check`, `terraform fmt -check`).

5. **Verify.** Format, typecheck, run the touched suites, rerun `lint` and report before and after counts for the fixed rules.

6. **Report and commit.** Fixed counts by rule, what was left and why (config `leave` and Jev `waive`), and **Needs your call**. Commit unless `--no-commit`. Push only when asked.

## Definition of done

- [ ] `lint` ran on every changed code file, filtered to lines the branch added.
- [ ] Every `enforce` finding is fixed, or listed with the reason it stays.
- [ ] Every `human` verdict is listed under **Needs your call** and left untouched, or the report says Jev was skipped and why.
- [ ] Every `leave` rule is named in the report with its reason from the config.
- [ ] Every `review` finding has a Jev verdict, or a decision of yours when Jev was skipped.
- [ ] Rerunning `lint` shows zero `fix` findings, apart from `waive`, `human` and the listed exceptions.
- [ ] `prettier --check` or the language's formatter parses every edited file.
- [ ] Typecheck and the touched suites pass, apart from failures listed as pre-existing on `BASE_REF`.

## Gotchas

- `lint` exits 1 while `fix` findings remain. That is the signal, not a crash.
- `skipped` means the linter is not on `PATH`. Report it; do not install tools unasked. `mop/no-comments` still ran for that language.
- A repo's own `eslint.config.mjs` and ruff config are ignored; `lint` applies the harness. Put repo taste in `mop.config.mjs` instead.
- unicorn's autofix for nested ternaries only adds parentheses, which still trips `sonarjs/no-nested-conditional`. Rewrite by hand.
- Destructuring to omit a key (`const { [key]: _removed, ...rest } = obj`) trips unused-variable rules but is the idiom; leave it.
