---
title: Run telemetry
description: What slopmop records about each mop run, where it goes, how to turn it off, and the record and stats commands.
type: reference
updated: 2026-11-05
owner: zico-io
---

`lint`, `judge` and `record` each append one line to a local JSONL file, so you can see which rules fire, what Jev decides and what the mops fix. `stats` summarizes the file.

```bash
npx -y slopmop stats
```

```text title="Output"
3 runs: 6 lint, 3 judge, 3 record events in /Users/you/.local/state/mop/runs.jsonl
median lint 2.1s, median judge 34.0s

   found      fix    leave   review  enforce    waive    human unjudged  cleared  rule
      14        0        0       14        2       12        0        0        2  no-console  (consider mop.leave)
       6        6        0        0        5        0        1        0        5  no-comments/disallowComments
```

## Where it goes

| Item | Value |
| --- | --- |
| File | `$XDG_STATE_HOME/mop/runs.jsonl`, else `~/.local/state/mop/runs.jsonl` |
| Format | One JSON object per line, appended. |
| Retention | 90 days. Each write first drops events older than that. |
| Network | None. The file never leaves your machine unless you send it. |
| Turn off | `MOP_TELEMETRY=0`. Nothing is written, and `stats` says telemetry is off. |

A write that fails, for example on a read-only disk, is skipped silently. Telemetry never changes a command's output or exit code.

## What it records

Paths, rule ids, counts, verdicts and timings. Never file contents, snippets, finding messages or environment values.

Every event has these properties:

| Property | Type | Description |
| --- | --- | --- |
| `v` | `1` | Schema version. |
| `at` | `string` | ISO timestamp. |
| `event` | `"lint" \| "judge" \| "record"` | The command that wrote it. |
| `run` | `string` | The `--run` id, when passed. Groups the events of one mop run. |
| `repo` | `string` | Absolute git root. |
| `branch` | `string` | Current branch. Absent on a detached HEAD. |
| `head` | `string` | Short HEAD commit. |

### `lint`

| Property | Type | Description |
| --- | --- | --- |
| `base` | `string` | Resolved base ref. Absent when files were passed. |
| `fix` | `boolean` | Whether `--fix` ran. |
| `files` | `number` | Files checked. |
| `lines` | `number` | Lines in scope: added lines, or every line of a whole file. |
| `sources` | `string[]` | Config files that loaded. |
| `configHash` | `string` | First 12 hex characters of the SHA-256 of the merged config. Changes when the config changes. |
| `skipped` | `string[]` | Languages whose linter was missing or failed. |
| `durationMs` | `number` | Whole command. |
| `phasesMs` | `{ eslint, languages }` | Time in ESLint and in the other languages' linters. |
| `byExt` | `Record<string, { files, lines, findings }>` | Totals per file extension. |
| `byRule` | `Record<string, { count, action, reason? }>` | As in `lint --json`. |
| `findings` | `{ file, line, rule, action }[]` | One entry per finding. |

### `judge`

| Property | Type | Description |
| --- | --- | --- |
| `mop` | `string` | The `--mop` value. Default: `code`. |
| `jev` | `boolean` | `false` under `JEV_ENABLED=0`. |
| `durationMs` | `number` | Whole command, mostly Jev. |
| `counts` | `Partial<Record<Verdict, number>>` | As in `judge --json`. |
| `findings` | `{ file, line, rule, verdict, probabilities? }[]` | One entry per finding. |

### `record`

| Property | Type | Description |
| --- | --- | --- |
| `mop` | `string` | The mop that finished. |
| `outcome` | `"done" \| "failed"` | `failed` when verification did not pass. |
| `fixed`, `left`, `human` | `number` | Findings the mop fixed, left on purpose, and listed under **Needs your call**. |

## `slopmop record`

Each mop calls it once, at the end, with the counts from its report.

```text
slopmop record --mop <name> [--run <id>] [--outcome done|failed] [--fixed <n>] [--left <n>] [--human <n>]
```

| Flag | Description |
| --- | --- |
| `--mop <name>` | Required. `code`, `tests`, `docs`, `ui` or `break`. |
| `--run <id>` | Run id, the same one passed to `lint` and `judge`. |
| `--outcome` | `done` or `failed`. Default: `done`. |
| `--fixed`, `--left`, `--human` | Whole numbers. Default: `0`. |

It prints the file it wrote to, or `telemetry is off`. A missing `--mop`, a bad `--outcome` or a count that is not a whole number exits 2.

## `slopmop stats`

```text
slopmop stats [--run <id>] [--json]
```

| Flag | Description |
| --- | --- |
| `--run <id>` | Summarize one run only. |
| `--json` | Print the summary as JSON. |

Per rule, `stats` counts:

| Column | Meaning |
| --- | --- |
| `found` | Findings in the first `lint` of each run. Later reruns in the same run do not add to it. |
| `fix`, `leave`, `review` | `found`, split by config action. |
| `enforce`, `waive`, `human`, `unjudged` | Jev verdicts across every `judge`. |
| `cleared` | First `lint` of a run minus its last `lint`. This is how many the mop fixed. |

A rule with at least 5 judged findings gets a hint. When 80% or more are `waive` and the config does not leave it, the hint is `consider mop.leave`. When 80% or more are `enforce` and the config does not fix it, the hint is `consider mop.fix`. See [mop.config](config.md).

Events without a `run` id count as one run each, so `cleared` is 0 for them. Pass `--run` to `lint` and `judge` to get before and after counts.

For questions `stats` does not answer, query the file directly:

```bash
jq -s 'map(select(.event == "lint")) | map(.phasesMs.eslint) | add / length' ~/.local/state/mop/runs.jsonl
```

## Next steps

- **Produce the events**: `slopmop lint --run`. [Learn more](lint.md)
- **Verdicts**: what `enforce`, `waive` and `human` mean. [Learn more](judge.md)
- **Act on a hint**: `mop.fix` and `mop.leave`. [Learn more](config.md)
- **Source**: the recorder and the summary. [Learn more](../../src/telemetry.ts)
