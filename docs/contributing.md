---
title: Contribute to mop
description: Set up the repo, change the harness or a mop, and ship the change with a changeset.
type: how-to
updated: 2026-10-08
owner: zico-io
---

Change the harness, a rule, or a mop skill, and ship it in the next release.

```bash
git clone https://github.com/zico-io/mop && cd mop
pnpm install
pnpm typecheck && pnpm test
node --import tsx bin/mop-lint.ts src/judge.ts
```

The last command runs `mop-lint` from source against one file, with no build step.

## Prerequisites

- Node 22 or later. CI runs Node 24.
- pnpm at the version in `packageManager` (`package.json`). An older pnpm reports the lockfile as broken. Run `npx -y pnpm@12.10.1 install` if your global pnpm cannot switch.
- The `jev` CLI with a key, only to test real judging. `jev auth status` checks the key.

## Find your way around

```text
src/
  harness.ts          harness(config): the flat ESLint config
  config.ts           loadConfig, merge, sortRule: layers and fix/leave/review
  changes.ts          merge base and added-line detection
  judge.ts            Jev questions and verdictOf
  presets/strict.ts   the default config every layer merges onto
  rules/              the test-guardrails plugin and restricted test syntax
bin/                  mop-lint and mop-judge CLIs
test/                 node:test suites
plugins/mop/          the Claude Code plugin: one folder per skill, plus JUDGE.md
scripts/              sync-plugin-version.ts, run at release
```

Read [How mop works](how-mop-works.md) first for the model behind these files.

## Change the harness

### Add or retune a rule

Add a new rule to the matching block in `src/harness.ts`. Put a value a user should tune in `Config` (`src/config.ts`) and give it a default in `src/presets/strict.ts`. Do not hard-code a number in the harness.

### Decide how mops sort it

Add the rule id to `mop.fix` in the strict preset when its fix is mechanical and safe on any codebase. Add it to `mop.leave` with a reason when it fights common conventions. Leave it in neither list to make it `review`, so Jev or the user decides.

### Test the behavior

Add an assertion to `test/harness.test.ts`. Lint a literal snippet with `harness()` and assert the rule id and line, as the existing test does. Run `pnpm test`.

### Try it on a real branch

From a branch in another repo, run the CLI from your checkout:

```bash
node --import tsx /path/to/mop/bin/mop-lint.ts --base main
```

## Change a mop

### Edit the skill

Each mop is `plugins/mop/skills/<name>/SKILL.md`, with recipes in `REFERENCE.md`. Keep the Arguments, Steps, Definition of done and Gotchas sections, because `/mop` relies on every mop having the same shape.

### Load your local copy

```bash
claude plugin validate ./plugins/mop
claude --plugin-dir ./plugins/mop
```

The plugin loads for that session only, as `mop@inline`. After you edit a skill, run `/reload-plugins` in the session to load the change. If you also installed mop from the marketplace, run `claude plugin disable mop@zico-io` while you develop, so only your checkout loads.

> **💡 Note:** The skills call `npx -y -p mop-harness`, which downloads the published package. A harness change in your checkout does not reach a mop until it ships. To test both together, point the skill's command at `node --import tsx /path/to/mop/bin/mop-lint.ts` locally, and do not commit that edit.

## Ship the change

### Add a changeset

```bash
pnpm changeset
```

Pick `patch`, `minor` or `major`, write one line for the changelog, and commit the file it writes in `.changeset/`. A docs-only or test-only change needs no changeset.

### Open a pull request

CI runs `pnpm typecheck` and `pnpm test` on every pull request.

### Merge the version PR

On `main`, the release workflow opens a "chore: version packages" PR. It bumps `package.json`, syncs the version into both plugin manifests, and writes `CHANGELOG.md`. Merge it to publish `mop-harness` to npm. Do not edit `CHANGELOG.md` or the manifest versions by hand.

## Don't

- Don't depend on your own `~/.config/mop` in a test. Pass `loadConfig({ cwd, user })` temporary directories, as `test/harness.test.ts` does.
- Don't call `jev` in a test. Pass a fake `run` to `judge()`, as `test/judge.test.ts` does.
- Don't add a rule to `mop.fix` because its autofix exists. unicorn's nested-ternary autofix only adds parentheses and still fails `sonarjs/no-nested-conditional`.

## Next steps

- **How mop works**: the model behind the code. [Learn more](how-mop-works.md)
- **Harness API**: the exports and rule sets you change. [Learn more](reference/harness.md)
- **Troubleshooting**: errors you may hit while developing. [Learn more](troubleshooting.md)
- **Judging**: what the Jev questions decide. [Learn more](../plugins/mop/JUDGE.md)
- **Changesets**: bump types and the CLI. [Learn more](https://changesets.dev)
