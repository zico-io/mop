---
name: tests
description: "Slop mop for tests: audits every test file a branch touches and covers the same behaviour with the fewest tests. Merges tests that assert facets of one behaviour into one journey or one literal input/output table, deletes tests another test already covers, fixes test slop (non-null assertions, global assignment, looped or conditional expects, service mocks), then proves nothing was lost by breaking the source and watching a remaining test fail. Use when the user says test audit, test slop, too many tests, consolidate tests, dedupe the tests, the test file is bloated, or /mop:tests. Not for finding bugs or adding coverage. Usage - /mop:tests, /mop:tests main --scope added, /mop:tests packages/api --no-commit"
---

Shrink a branch's tests to one test per behaviour, with proof that coverage held.

**Arguments:** `$ARGUMENTS`
- `BASE_REF`: the name of the branch the PR targets, without `origin/`. Default: the open PR's base, else the repo's default branch.
- A path or package: audit every test file under it instead of the branch's changes.
- `--scope touched` (default): every test in each touched file. `--scope added`: only tests the branch added or changed.
- `--no-commit`: stop after verification.

## Steps

1. **Scope.** List test files from `git diff --name-only "origin/$BASE_REF"...HEAD` (or under the given path). Record each file's test count and size. Print the table before editing.

2. **Partition.** Group files so no two groups share a file, keeping a subject together (UI tests, data tests, server and package tests). Aim for 3 groups, never more than 6. Launch one subagent per group in one message, in the background.

3. **Brief each subagent** with its files, the repo path, the test and typecheck commands, and the rules in [REFERENCE.md](REFERENCE.md#subagent-brief) verbatim. Ask for the report listed there. If the user changes scope mid-run, SendMessage each running subagent instead of restarting it.

4. **Verify.** `git status --short` shows no stray files. Review each diff and reject merges that dropped an `expect`, swapped a literal for `expect.any`, or added a mock. Run typecheck and every touched suite with its own package runner. Compare failures with `BASE_REF`; report pre-existing ones.

5. **Report and commit.** One table: area, tests before, tests after. Then deletions beyond merges, mutation results, pre-existing failures, and what subagents flagged but left (such as service mocks). Commit as `test: cover the same behaviour with fewer tests` with the totals in the body. Push only when asked.

## Definition of done

- [ ] Every test file in scope was read in full, not only its changed lines.
- [ ] Each remaining test covers a behaviour no other remaining test covers.
- [ ] Every deleted test names the remaining test that fails if its behaviour breaks.
- [ ] No merge dropped an `expect`, swapped a literal for `expect.any`, or added a mock.
- [ ] At least 3 mutation checks per subagent each failed a remaining test, and `git diff` shows no source file changed.
- [ ] No non-null assertions, `globalThis` assignments, or `expect` inside loops or conditionals on the lines touched.
- [ ] Typecheck and every touched suite pass, apart from failures listed as pre-existing on `BASE_REF`.
- [ ] The report gives before and after counts from the test runner, not from counting `it(`.

## Gotchas

- `it(` counts hide `it.each` rows. Use the runner's case count when the number matters.
- A service mock found during the audit is a separate fix: stub its repository instead, use a fixed clock for timestamps, and mutation-check through the real service.
- Radix and similar libraries register outside-click listeners a tick after mount, so a 0ms wait before a pointer event is required, not slop.
