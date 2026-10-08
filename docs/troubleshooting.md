---
title: Troubleshooting
description: mop-lint, mop-judge and config errors, what causes them, and how to fix them.
type: troubleshooting
updated: 2026-10-08
owner: zico-io
---

Find your error message below. Each entry gives the cause, the fix, and how to stop it coming back.

## `fatal: ref refs/remotes/origin/HEAD is not a symbolic ref`

**Cause.** You ran `mop-lint` with no `--base`, and the clone has no `origin/HEAD`. Local-only repos and some CI checkouts lack it.

**Fix.** Pass the base branch:

```bash
npx -y -p mop-harness mop-lint --base main
```

**Prevent.** Run `git remote set-head origin --auto` once in the clone.

## `fatal: Not a valid object name <ref>`

**Cause.** The `--base` ref does not exist locally as `origin/<ref>` or `<ref>`. Shallow CI clones often lack the base branch.

**Fix.** Fetch it, then run again:

```bash
git fetch origin main
npx -y -p mop-harness mop-lint --base main
```

**Prevent.** In CI, check out with full history, for example `fetch-depth: 0` on `actions/checkout`.

## `fatal: not a git repository`

**Cause.** `mop-lint` finds the config and the diff from the git root, so it needs a repository.

**Fix.** Run it inside the repository.

## `mop-lint` exits 1 with no stack trace

**Cause.** At least one finding is tagged `fix`. This is the signal for "slop remains", not a crash.

**Fix.** Run `/mop:code`, or `mop-lint --base main --fix` and review the diff. To stop a rule failing the run, move it to [`mop.leave`](reference/config.md#mopleave).

## `<comment> has no effect because you have 'noInlineConfig' setting in your config`

**Cause.** `strict` sets `inlineConfig: false`, so ESLint ignores `eslint-disable` comments and reports each one. `mop-lint` shows this finding under the rule `eslint-directive`.

**Fix.** Delete the comment. Turn the rule off in [`rules`](reference/config.md#rules) if it does not fit the repo.

**Prevent.** Set `inlineConfig: true` in the repo `mop.config` only if the repo depends on disable comments.

## `Parsing error: <message>` under `parse-error`

**Cause.** ESLint could not parse the file. Every other rule is skipped for that file.

**Fix.** Fix the syntax error first, then run `mop-lint` again.

## `Comments are forbidden` on a comment you want to keep

**Cause.** The comment does not start with a [`comments.allow`](reference/config.md#commentsallow) entry. JSDoc blocks fail too, because their text starts with `*`.

**Fix.** Add the prefix, and keep the defaults, because the array replaces them:

```js title="mop.config.mjs"
export default {
  comments: { allow: ["eslint", "global", "@ts-", "@vitest-environment", "prettier-ignore", "ponytail:"] },
};
```

**Prevent.** Run `mop-lint --print-config` after you edit an array, and check that the defaults stayed.

## A default rule or `fix` entry disappeared

**Cause.** Arrays replace whole. A repo `mop.fix: ["unicorn/*"]` drops the 15 `strict` entries.

**Fix.** Copy the current list from `mop-lint --print-config` into your config, then add your entries.

## `Mocking first-party module '<path>'`

**Cause.** `test-guardrails/no-internal-module-mock` treats relative paths, `@/`, `~/`, `#/`, `src/` and workspace package names as first-party.

**Fix.** Use the real module and mock the process boundary it reaches. If `<path>` is that boundary, allow it:

```js title="mop.config.mjs"
export default { tests: { allowMocks: ["^@acme/payments-sdk$"] } };
```

## `Direct process.env access forbidden`

**Cause.** The [`env`](reference/config.md#env) ban is on in `strict`.

**Fix.** Read config in one environment module and pass values in. In a repo with no such module, set `env: false`.

## `Error: Cannot find module '<name>'`

**Cause.** An `extends` entry names a package that does not resolve from the config file's directory.

**Fix.** Install the package in that repo, or use a relative path that starts with `./`.

## `Error: ENOENT: no such file or directory, open '<path>'`

**Cause.** An `extends` path, or the input file to `mop-judge`, does not exist. `extends` paths resolve from the config that names them, not from the current directory.

**Fix.** Correct the path.

## `SyntaxError: ... in JSON at position <n>`

**Cause.** A `mop.config.json` file, or the `mop-judge` input, is not valid JSON.

**Fix.** Fix the JSON. A `.mjs` config allows comments and trailing commas.

## A rule from my `eslint.config.mjs` does not run

**Cause.** `mop-lint` reads only `mop.config` and ignores the repo's ESLint config.

**Fix.** Put the rule in [`rules`](reference/config.md#rules) in `mop.config`.

## Every verdict is `unjudged`

**Cause.** `mop-judge` could not use Jev. The `why` field says which case applies.

| `why` | Fix |
| --- | --- |
| `jev failed: spawn jev ENOENT` | Install the `jev` CLI and put it on the `PATH`. |
| `jev failed: <other error>` | Run `jev auth status`, then `jev doctor`. |
| `JEV_ENABLED=0` | Unset `JEV_ENABLED`. |
| `jev returned no answer` | Jev skipped that finding. Run the command again. |

The mops still run without Jev. They fall back to the config sort and say so in the report.

## A mop ignores my local harness change

**Cause.** The mop skills run `npx -y -p mop-harness`, which downloads the published package.

**Fix.** Run your checkout directly with `node --import tsx /path/to/mop/bin/mop-lint.ts`. See [Contribute to mop](contributing.md#load-your-local-copy).

## `ERR_PNPM_BROKEN_LOCKFILE ... expected a single document in the stream`

**Cause.** Your pnpm is older than the version in `packageManager` and cannot read the lockfile.

**Fix.** Run `npx -y pnpm@12.10.1 install`.

## Next steps

- [Open an issue](https://github.com/zico-io/mop/issues/new) with the command, the full output, and your `mop-lint --print-config`.
- [mop-lint reference](reference/mop-lint.md): flags, scope and exit codes.
- [mop.config reference](reference/config.md): every key and default.
- [mop-judge reference](reference/mop-judge.md): verdict rules.
