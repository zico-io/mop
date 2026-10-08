---
name: mop
description: "Cleans up everything a branch changed: sorts its changed files by type, runs the matching slop mop on each group (tests, code, docs, ui), then verifies the whole branch once. Use when the user says mop, slop mop, de-slop, clean up this branch, tidy this PR before review, remove the AI slop, or /mop. For one kind of file only, use /mop:tests, /mop:code, /mop:docs or /mop:ui directly. Usage - /mop, /mop main, /mop code ui --no-commit"
---

Run every slop mop that applies to a branch, then verify once.

**Arguments:** `$ARGUMENTS`
- Mop names (`tests`, `code`, `docs`, `ui`): run only these. Default: every mop with files in scope.
- `BASE_REF`: the name of the branch the PR targets, without `origin/`. Default: the open PR's base (`gh pr view --json baseRefName`), else the repo's default branch.
- A path or package (for example `packages/docs`): limit scope to it.
- `--no-commit`: stop after verification.

## Steps

1. **Scope.** `git fetch -q origin "$BASE_REF"`, then `git diff --name-only "origin/$BASE_REF"...HEAD`. Sort the files:

   | Mop | Files |
   |---|---|
   | tests | `*.test.*`, `*.spec.*` |
   | code | other `.ts`, `.tsx`, `.js`, `.mjs`, `.py` |
   | docs | `.md`, `.mdx`, READMEs, docs content folders |
   | ui | `.tsx`, `.jsx`, `.css`, `.html` that render UI (also in code) |

   Print the counts per mop before running anything.

2. **Order.** Run `code`, then `ui`, then `tests`, then `docs`. Code edits can break tests, and the test mop proves coverage against the final source.

3. **Run.** Invoke each mop's skill (`/mop:code` and so on) with its file list, one mop at a time. Each mop commits its own work before the next one starts, so code and ui edits to the same file stay in separate commits. Pass `--no-commit` to every mop only when the user passed it to `/mop`. A mop with more than about 15 files fans out to subagents itself; do not nest a second fan-out on top.

4. **Verify once.** Typecheck, lint, and every touched test suite, using the repo's own commands. A failure that also fails on `BASE_REF` is pre-existing: report it, do not fix it here.

5. **Report.** One table: mop, findings before, findings after, files changed. Then what each mop left on purpose and why. Fixes made during verification go in one final commit, unless `--no-commit`, which leaves every change uncommitted. Push only when the user asks.

## Definition of done

- [ ] Every mop with files in scope ran, or the report says why it was skipped.
- [ ] Typecheck passes, or every error also fails on `BASE_REF`.
- [ ] Every touched test suite passes, or every failure also fails on `BASE_REF` and is listed as pre-existing.
- [ ] `git status --short` shows only the intended changes: no backups, temporary configs or agent working copies.
- [ ] The report has the per-mop table (findings before, after, files changed) and each mop's "left on purpose" list with a reason per item.
- [ ] One commit per mop plus at most one verification commit, or nothing committed at all under `--no-commit`. Nothing pushed unless the user asked.

## Gotchas

- Run mops one at a time. Two mops editing the same `.tsx` file at once lose each other's edits.
- Lint autofixes rewrite whole files. Every mop keeps its edits to lines the branch owns, or reports the churn.
- Never use bare `git stash`. Set work aside with a WIP commit.

## Reference

- Each mop's rules and recipes: [tests](../tests/SKILL.md), [code](../code/SKILL.md), [docs](../docs/SKILL.md), [ui](../ui/SKILL.md), and their `REFERENCE.md` files.
- Dependencies per mop: [plugin README](../../README.md).
