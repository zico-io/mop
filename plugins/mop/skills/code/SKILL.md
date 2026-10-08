---
name: code
description: "Slop mop for code: lints a branch's changed lines with mop-lint (a strict ESLint harness tuned per repo, org and taste through mop.config files), then fixes the findings that are real slop (comments the branch added, nested ternaries, dead code, non-null assertions, implicit length checks, array lookups that should be Sets) and leaves the ones the config marks as fighting the repo's conventions, with typecheck and tests as proof. Use when the user says code slop, harness lint, de-slop the code, lint my changes, strip the comments I added, or /mop:code. Not for over-engineering review (use /ponytail-review) or bugs (use /code-review). Usage - /mop:code, /mop:code main, /mop:code packages/api --no-commit"
---

Fix the slop the branch added to its code, on the lines it owns.

**Arguments:** `$ARGUMENTS`
- `BASE_REF`: the name of the branch the PR targets, without `origin/`. Default: the open PR's base, else the repo's default branch. Or a path to lint everything under it.
- `--no-commit`: stop after verification.

## Steps

1. **Lint changed lines.** From the repo root:
   ```bash
   npx -y -p github:zico-io/mop mop-lint --base "$BASE_REF" --json > /tmp/mop-lint.json
   ```
   Pass paths instead of `--base` to lint whole files. mop-lint compares the working tree with the merge base, keeps only findings on lines the branch added, and tags each one `fix`, `leave` (with the reason) or `review` from the merged config. Report `byRule` counts and `sources` (which config files applied).

2. **Sort.** `fix` and `leave` come from the config; see [REFERENCE.md](REFERENCE.md#config) for how layers merge. Decide each `review` rule yourself, and name it in the report. Show the split and wait for a go-ahead when it is over about 100 fixes.

3. **Fix** with the recipes in [REFERENCE.md](REFERENCE.md#fix-recipes). `mop-lint --base "$BASE_REF" --fix` autofixes only `fix` rules and only on lines the branch added; review the result. Recheck every edited file with `prettier --check`.

4. **Verify.** Format, typecheck, run the touched suites, rerun mop-lint and report before and after counts for the fixed rules.

5. **Report and commit.** Fixed counts by rule, what was left and why, and any `review` rule you chose to fix or leave. Commit unless `--no-commit`. Push only when asked.

## Definition of done

- [ ] mop-lint ran on every changed code file, filtered to lines the branch added.
- [ ] Every `fix` finding is fixed, or listed with the reason it stays.
- [ ] Every `leave` rule is named in the report with its reason from the config.
- [ ] Every `review` rule has a decision in the report.
- [ ] Rerunning mop-lint shows zero `fix` findings, apart from the listed exceptions.
- [ ] `prettier --check` parses every edited file.
- [ ] Typecheck and the touched suites pass, apart from failures listed as pre-existing on `BASE_REF`.

## Gotchas

- mop-lint exits 1 while `fix` findings remain. That is the signal, not a crash.
- A repo's own `eslint.config.mjs` is ignored; mop-lint applies the harness. Put repo taste in `mop.config.mjs` instead.
- unicorn's autofix for nested ternaries only adds parentheses, which still trips `sonarjs/no-nested-conditional`. Rewrite by hand.
- Destructuring to omit a key (`const { [key]: _removed, ...rest } = obj`) trips unused-variable rules but is the idiom; leave it.
