---
name: break
description: "Adversarial mop for code: attacks what a branch changed to break it, with subagents that each take one angle (hostile inputs, state and ordering, failure paths, broken contracts and security). Keeps only holes it can reproduce, fixes the real defects on lines the branch owns with a regression test that fails without the fix, and hands the judgment calls to you. Use when the user says break it, poke holes, adversarial review, red-team this, find edge cases, try to break my code, stress the logic, or /mop:break. Not for slop or style (use /mop:code) or a findings-only review with no fixes (use /code-review). Usage - /mop:break, /mop:break main, /mop:break packages/api --no-commit"
---

Try to break what the branch changed. Report only what you can reproduce, fix the defects, and prove each fix.

**Arguments:** `$ARGUMENTS`
- `BASE_REF`: the name of the branch the PR targets, without `origin/`. Default: the open PR's base, else the repo's default branch.
- A path or package: attack everything under it instead of the branch's changes.
- `--no-commit`: stop after verification.

## Steps

1. **Scope.** List code files from `git diff --name-only "origin/$BASE_REF"...HEAD` (or under the given path), skipping tests, docs and generated files. Read the diff, then the callers and callees of every changed function. Print the files and the public entry points (exports, CLI commands, routes, handlers) the branch added or changed.

2. **Attack.** Launch one subagent per lens in [REFERENCE.md](REFERENCE.md#lenses), in one message, in the background. Each attacks the whole scope. Over about 15 files, split the files into 2 groups and run each lens per group, never more than 8 subagents. Brief each with the scope, the test and typecheck commands, its lens, and the rules in [REFERENCE.md](REFERENCE.md#subagent-brief) verbatim.

3. **Triage.** Merge findings that share a root cause. Rerun every reproduction yourself on the current tree. Drop any finding whose reproduction does not fail. Sort the rest with [REFERENCE.md](REFERENCE.md#classes) into `defect`, `question` and `pre-existing`.

4. **Fix defects.** One at a time, smallest change first:
   1. Turn the reproduction into a regression test beside the module's existing tests, in the repo's own framework, with literal expected values.
   2. Fix the source with the smallest change. Guard at the boundary the bad input crosses, not deep inside.
   3. Run the test and watch it pass. Revert the fix, watch the test fail, then restore the fix.

   A fix that changes a public API, user-facing copy or a file format becomes a `question`.

5. **Verify.** Run typecheck, every touched suite and every remaining reproduction. Compare failures with `BASE_REF` and report pre-existing ones. `git status --short` shows no scratch files.

6. **Report and commit.** One table with one row per finding: where, lens, attack, outcome (`fixed`, `question`, `pre-existing`). Then the attacks that held, grouped by lens, so the reader sees what was tried. End with **Needs your call**, one row per `question` and `pre-existing` finding, in the table format from [JUDGE.md](../../JUDGE.md#needs-your-call), with the reproduction as the reason. Commit as `fix: close holes found by adversarial review` unless `--no-commit`. Push only when asked.

## Definition of done

- [ ] Every lens ran against every file in scope, or the report says why it was skipped.
- [ ] Every reported finding has a reproduction that failed when you reran it. Unreproduced suspicions are not reported.
- [ ] Every fixed defect has a regression test that failed with the fix reverted and passes with it.
- [ ] No fix touches lines the branch does not own. Holes in base code are listed as `pre-existing`.
- [ ] Every `question` and `pre-existing` finding is listed under **Needs your call** and left unfixed.
- [ ] The report lists the attacks that held, per lens.
- [ ] Typecheck and every touched suite pass, apart from failures listed as pre-existing on `BASE_REF`.
- [ ] `git status --short` shows only regression tests and fixes: no scratch scripts or reproduction files.

## Gotchas

- Proof replaces Jev here. A bug fix always changes behaviour, so Jev's `risky` question would send every finding to you. The reproduction is the evidence, and the classes decide what gets fixed.
- A reproduction that mocks the module under test proves only the mock. Drive the real code.
- A reproduction that fails only sometimes is a race, not noise. Run it 20 times and report the failure rate.
- Never make an attack pass by weakening a type, a test or a check. That hides the hole.
- Run `/mop:break` after the other mops. Its regression tests and fixes go on top of the cleaned code.
