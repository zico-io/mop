# mop:break reference

## Lenses

One subagent per lens. Each lens lists where to start, not where to stop.

| Lens | Attacks |
|---|---|
| inputs | Empty, missing, `null` and `undefined`. Zero, negative, `NaN`, `Infinity`, huge numbers and very long strings. Unicode, whitespace, path separators and `..`. Duplicates and unsorted data. Malformed JSON, wrong types at a boundary, extra or missing keys. |
| state | The same call twice, re-entry, concurrent calls and interleaved awaits. Retry after a partial failure. Stale caches and memoized values. Events out of order. Cleanup when a step throws. Resources left open. |
| failures | A dependency that throws, rejects, times out or returns nothing. A missing file, a denied permission, a full disk, the network down. Partial writes. Errors swallowed by `catch`. Error messages that leak secrets or paths. |
| contracts | Callers that use the API in ways its types allow but its code does not handle. Casts, `any` and non-null assertions that lie. Off-by-one and boundary values. Inverted conditions. Time zones, locales and float rounding. Injection into shell, SQL, regex or paths, ReDoS, and prototype pollution. |

## Subagent brief

Pass these rules to each subagent verbatim.

1. Attack only through your lens. Read the diff and every function it calls or is called by, in full.
2. For each suspected hole, write the smallest reproduction that drives the real code: a test in the repo's framework, or a script. Keep scripts in a scratch directory outside the repo.
3. Run it. Report a hole only when the reproduction fails. A suspicion you cannot reproduce goes in "held", with what you tried.
4. Name the contract the code breaks: its types, docs, name, an existing test, or what a caller relies on. "I would have done it differently" is not a hole.
5. Do not edit source files. Do not commit. Never use bare `git stash`. End with `git status --short` showing nothing you created.

## Subagent report

For each hole:

| Field | Content |
|---|---|
| Where | `file:line` |
| Attack | The input or sequence, as a literal |
| Expected | What the contract promises, and where it says so |
| Actual | The observed output, error or state |
| Reproduction | The test or the script, in full, and the command that runs it |
| Fix | The smallest change you would make, as a diff |

Then the attacks that held, one line each.

## Classes

| Class | When | Do |
|---|---|---|
| `defect` | The reproduction shows a crash, data loss, a security hole, or a break of the code's own stated contract, on lines the branch owns, and the fix is local | Fix it with a regression test |
| `question` | The right behaviour is a product call, the contract is unclear, or the fix changes a public API, user-facing copy or a file format | Add it to **Needs your call** |
| `pre-existing` | The hole is in code the branch did not change, and it also fails on `BASE_REF` | Add it to **Needs your call** as pre-existing |
