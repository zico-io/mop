# mop:tests reference

## Subagent brief

Pass these rules to each subagent verbatim.

1. One test per behaviour. Merge tests that render the same setup and assert facets of one behaviour or one user journey. Turn per-case tests into one test that maps a literal input array to a literal expected array.
2. Delete a test only when another remaining test, in these files or elsewhere in the repo (grep to confirm), already fails if that behaviour breaks. Name the covering test.
3. Never weaken an assertion. Keep literal expected values. A merged test keeps every `expect` of the tests it replaces.
4. Never mock a service or orchestrator. Stub only the data layer (repos, queries) and external `fetch`. If an existing test mocks a service, report it instead of reworking it.
5. Fix test slop on the lines you touch: non-null assertions (throw a named error from a helper instead), assignment to `globalThis` (use `vi.stubGlobal`), `expect` inside loops or conditionals (collect failures into a list and assert it equals `[]`), helpers nested inside `describe` that use nothing from it (hoist them).
6. No code comments in tests, except environment directives such as `// @vitest-environment`.
7. Do not commit. Never use bare `git stash`.
8. Mutation-check at least 3 merged behaviours: copy the source file aside, break the behaviour, run the tests, confirm a remaining test fails, restore the copy. End with `git diff` showing no source file changed.

## Subagent report

- Before and after test counts per file.
- A table of every removed or merged test and the test that now covers it.
- The mutation checks and their results.
- Test and typecheck output.

## Example: per-case tests to one table

```ts
// before: three tests
it("slugs spaces", () => expect(slug("a b")).toBe("a-b"));
it("slugs case", () => expect(slug("A")).toBe("a"));
it("slugs symbols", () => expect(slug("a&b")).toBe("a-b"));
// after: one test, same literals
it("slugs input", () => {
  expect(["a b", "A", "a&b"].map(slug)).toEqual(["a-b", "a", "a-b"]);
});
```
