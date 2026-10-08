---
title: slopmop lint
description: The slopmop lint command: flags, scope, output format and exit codes.
type: reference
updated: 2026-10-08
owner: zico-io
---

`lint` lints the lines a branch added with the harness, and tags each finding `fix`, `leave` or `review`.

```bash
npx -y slopmop lint --base main
```

```text title="Output"
5 findings in 2 files (lines added since origin/main)
    3  review  id-length
    1  fix     no-comments/disallowComments
    1  leave   unicorn/no-null  (Leave where the codebase uses null.)
```

## Usage

```text
slopmop lint [--base <ref>] [--fix] [--json]
slopmop lint <file...> [--fix] [--json]
slopmop lint --print-config
```

Run it anywhere inside a git repository. It loads config from the git root, not the current directory.

## Flags

| Flag | Description |
| --- | --- |
| `--base <ref>` | Branch to compare with. `lint` uses `origin/<ref>` when it exists, else `<ref>`. Default: `origin/HEAD`. |
| `--fix` | Autofix findings tagged `fix`, only on lines in scope. Other findings stay. |
| `--json` | Print one JSON object instead of the summary. |
| `--print-config` | Print the merged config and its `sources`, then exit 0. |
| `<file...>` | Lint these whole files. `--base` is ignored. |

## Scope

With no file arguments, `lint` checks:

- Files that are added or modified between the merge base and the working tree, and untracked files that are not ignored.
- Only `.js`, `.jsx`, `.ts`, `.tsx` files and their `.c*` and `.m*` variants.
- Only the lines that the diff adds. An untracked file counts as fully added.

The merge base is fixed, so commits that land on the base after you branch do not count. Deleted lines and context lines are never in scope.

## Output

### Text

The first line counts findings and files. Each next line is one rule: count, action, rule id, and the `leave` reason in parentheses. Rules sort by count, highest first.

### JSON

| Property | Type | Description |
| --- | --- | --- |
| `base` | `string \| undefined` | The resolved base ref. Absent when files were passed. |
| `sources` | `string[]` | Taste and repo config files that loaded. `extends` targets are not listed. |
| `files` | `number` | Files checked. |
| `byRule` | `Record<string, { count, action, reason? }>` | Totals per rule. |
| `findings` | `Finding[]` | One entry per finding, as below. |

| Finding property | Type | Description |
| --- | --- | --- |
| `file` | `string` | Path from the git root. |
| `line` | `number` | 1-based line. |
| `rule` | `string` | ESLint rule id. `parse-error` when ESLint could not parse the file. `eslint-directive` for a notice about an inline `eslint-` comment. |
| `message` | `string` | ESLint message. |
| `action` | `"fix" \| "leave" \| "review"` | From `mop.fix` and `mop.leave`. |
| `reason` | `string` | Present when `action` is `leave`. |

`judge` reads this JSON as it is.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | No finding is tagged `fix`. `leave` and `review` findings do not fail the run. |
| `1` | At least one `fix` finding remains, or the run crashed. |

## Don't

- Don't read exit code `1` as a crash. Check the output first. A crash prints a stack trace.
- Don't trust `--fix` blind. Lint autofixes can rewrite more than the flagged line. Review the diff.
- Don't pass a file list when you want the branch scope. File arguments lint every line of those files.

## Next steps

- **Config keys**: what decides `fix`, `leave` and `review`. [Learn more](config.md)
- **Judge the findings**: pipe the JSON into `judge`. [Learn more](judge.md)
- **Errors**: what each crash means. [Learn more](../troubleshooting.md)
- **Source**: the CLI. [Learn more](../../bin/lint.ts)
