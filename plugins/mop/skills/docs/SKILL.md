---
name: docs
description: "Slop mop for docs and prose: lints a branch's changed Markdown and MDX with the repo's doc linter, then rewrites AI prose tells (em dashes, mid-sentence colons, inflated vocabulary, rule-of-three, passive voice, over-long paragraphs) and broken structure (numbered steps folded into a paragraph) without changing facts. Use when the user says docs slop, doc lint, unslop the docs, this reads like AI, too many em dashes, clean up the prose, or /mop:docs. Not for writing new docs (use /technical-docs) or a grammar-only STE pass (use /simplified-technical-english). Usage - /mop:docs, /mop:docs main, /mop:docs docs/guides --no-commit"
---

Clean the prose a branch changed, keeping every fact.

**Arguments:** `$ARGUMENTS`
- `BASE_REF` or a path, as for the other mops.
- `--no-commit`: stop after verification.

## Steps

1. **Scope.** Changed `.md` and `.mdx` files, plus READMEs and docs content folders. Skip generated files and changelogs written by tools.

2. **Lint.** Run the repo's doc linter (the command CI runs, for example `node scripts/doclint.mjs docs --max-warnings 0`). Record findings. No linter in the repo: go on, and say in the report that the lint gate was skipped.

3. **Judge.** Write the linter findings, plus each slop pattern you mean to rewrite (rule = the pattern name, message = the phrase), and send them to Jev with `--mop docs`, following [JUDGE.md](../../JUDGE.md). Fix only `enforce` findings.

4. **Fix structure first.** A numbered list needs a blank line before it, or Markdown folds its steps into the paragraph above and Prettier joins them. Long paragraphs (the lint's sentence limit) usually hide a list.
   ```md
   Set up the webhook:
   1. Open **Settings**.
   ```
   renders as one paragraph. Put a blank line after `Set up the webhook:` to get a list.

5. **Read for slop.** Load the `unslop` skill (pstack) and apply its patterns to the changed paragraphs; the short list with before and after examples is in [REFERENCE.md](REFERENCE.md#slop-patterns). For procedural docs, also apply `simplified-technical-english`: one instruction per step, imperative mood.

6. **Rewrite, never invent.** Keep product names, UI labels in bold exactly as the product shows them, numbers, and links. If a sentence makes a claim you cannot verify from the repo, keep it and flag it rather than rewording it into a new claim.

7. **Verify.** Rerun the doc linter to zero warnings apart from `waive` and `human` findings, and run Prettier on the files. Report before and after findings, `waive` findings with their reason, and **Needs your call**.

8. **Commit** unless `--no-commit`. Push only when asked.

## Definition of done

- [ ] The repo's doc linter reports zero errors and zero warnings on the files in scope apart from `waive` and `human` findings, or the report says the repo has no linter.
- [ ] Every `human` verdict is listed under **Needs your call** and left untouched, or the report says Jev was skipped and why.
- [ ] No em dashes, mid-sentence colons, or "serves as" style phrasing remain in changed paragraphs.
- [ ] Every numbered procedure renders as a list: a blank line before it, one instruction per step.
- [ ] Every product name, bold UI label, number and link from the original text is still there.
- [ ] Claims that could not be checked against the repo are flagged in the report, not rewritten.
- [ ] Prettier has run on every edited file, and the doc linter still passes after it.

## Gotchas

- A merge that touches docs content can re-fold lists through the commit hook's Prettier run; check the doc linter after every merge.
- Brand rules from memory or the repo override style rules (for example a lowercase domain or a product name's casing).
- `unslop` ships with pstack. If it is not installed, apply the step 4 list directly; it covers the patterns that matter here.
