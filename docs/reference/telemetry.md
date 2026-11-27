---
title: Run telemetry
description: What slopmop records about each mop run, where it goes, how to turn it off or ship it to an OTLP endpoint, and the record, resolve and stats commands.
type: reference
updated: 2026-11-27
owner: zico-io
---

`lint`, `judge`, `record` and `resolve` each append one line to a local JSONL file, so you can see which rules fire, what the judge decides and what the mops fix. `stats` summarizes the file. In full mode each event also goes to an OTLP endpoint, with enough content to calibrate and train the judge.

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
| Network | None, unless `MOP_TELEMETRY=full`. See [Full mode](#full-mode). |
| Turn off | `MOP_TELEMETRY=0`. Nothing is written or sent, and `stats` says telemetry is off. |

A write or send that fails, for example on a read-only disk or an unreachable endpoint, is skipped silently. Telemetry never changes a command's output or exit code.

## Full mode

`MOP_TELEMETRY=full` keeps the local file as it is and also sends every event, as one OTLP log record, to an OpenTelemetry collector. A collector with the ClickHouse exporter writes them to the `otel_logs` table.

| Variable | Description |
| --- | --- |
| `MOP_TELEMETRY=full` | Turn shipping on. Any other value, or none, keeps telemetry local. |
| `MOP_OTLP_ENDPOINT` | Your own collector's base URL, for example `https://otel.example.com`. For the HTTP protocols, `/v1/logs` is appended unless the URL already ends in it. For `grpc`, give the host and port, as in `http://localhost:4317`; `https` uses TLS. |
| `MOP_OTLP_HEADERS` | Headers for your collector, in the OpenTelemetry format `key=value,key2=value2`, with values URL-encoded. For example `authorization=Basic%20dXNlcjpwYXNz`. Header names are lowercased. |
| `MOP_OTLP_PROTOCOL` | `http/json`, `http/protobuf` or `grpc`. Default: `http/json`. Any other value sends nothing. |

Releases from npm have a built-in collector, so `MOP_TELEMETRY=full` alone is enough. The release workflow inlines its endpoint from the `MOP_OTLP_ENDPOINT` repository secret and its protocol from the `MOP_OTLP_PROTOCOL` repository variable. It is sent no headers and carries no credentials; a proxy in front of it handles authentication. Builds from a checkout or a fork have none.

Setting `MOP_OTLP_ENDPOINT` switches to your own collector, and then your `MOP_OTLP_HEADERS` and `MOP_OTLP_PROTOCOL` apply. `MOP_OTLP_HEADERS` and `MOP_OTLP_PROTOCOL` do nothing without `MOP_OTLP_ENDPOINT`, so your headers never reach the built-in collector.

The mop-specific variables mean an `OTEL_EXPORTER_OTLP_*` setting meant for another tool never receives code.

Shipped events carry everything the local event does, plus finding content:

| Event | Extra properties per finding |
| --- | --- |
| `lint` | `message` |
| `judge` | `message`, `why`, and `snippet`: the lines the judge saw, as sent to the decisions API |

That content is source code. Only turn full mode on for repos whose code may leave the machine. Shipped events leave out `repo`, the absolute local path; `origin` and `head` identify the code instead.

Each log record has:

| Field | Value |
| --- | --- |
| `timeUnixNano` | The event's `at`. |
| `eventName`, attribute `event.name` | `mop.lint`, `mop.judge`, `mop.record` or `mop.resolve`. |
| `body.stringValue` | The whole event as JSON. |
| Attributes | `mop.schema`, plus `mop.run`, `mop.origin`, `mop.branch`, `mop.head`, `mop.mop` and `mop.by` when set. |
| Resource | `service.name` `slopmop`, `service.version` the slopmop version. |

Each send times out after 5 seconds and is not retried.

## What it records

Paths, rule ids, finding ids, counts, verdicts, probabilities and timings. The local file never holds file contents, snippets, finding messages or environment values.

Every event has these properties:

| Property | Type | Description |
| --- | --- | --- |
| `v` | `2` | Schema version. Version 1 events have no `version`, `origin` or finding `id`, and round probabilities to two decimals. |
| `at` | `string` | ISO timestamp. |
| `version` | `string` | The slopmop version that wrote it. |
| `event` | `"lint" \| "judge" \| "record" \| "resolve"` | The command that wrote it. |
| `run` | `string` | The `--run` id, when passed. Groups the events of one mop run. |
| `repo` | `string` | Absolute git root. Local file only; never shipped. |
| `origin` | `string` | URL of the `origin` remote, without credentials. Absent when there is none. |
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
| `findings` | `{ id, file, line, rule, action }[]` | One entry per finding. |

A finding `id` is 16 hex characters: a hash of the rule, the file and the trimmed text of the flagged line, plus a counter for repeats of the same text. It survives the line moving, so the same finding gets the same id across the lints of a run. It changes when the flagged line's text changes, which is how a fix shows up.

### `judge`

| Property | Type | Description |
| --- | --- | --- |
| `mop` | `string` | The `--mop` value. Default: `code`. |
| `judge` | `false \| { provider: string; model?: string }` | The decisions provider and model asked, or `false` under `MOP_JUDGE=0`. |
| `auto` | `number` | The certainty an answer needed to count as sure, `0.9`. |
| `configHash` | `string` | As in `lint`. |
| `durationMs` | `number` | Whole command, mostly the decisions API. |
| `counts` | `Partial<Record<Verdict, number>>` | As in `judge --json`. |
| `findings` | `{ id, file, line, rule, verdict, probabilities? }[]` | One entry per finding. `probabilities` are unrounded. |

### `record`

| Property | Type | Description |
| --- | --- | --- |
| `mop` | `string` | The mop that finished. |
| `outcome` | `"done" \| "failed"` | `failed` when verification did not pass. |
| `fixed`, `left`, `human` | `number` | Findings the mop fixed, left on purpose, and listed under **Needs your call**. |

### `resolve`

| Property | Type | Description |
| --- | --- | --- |
| `mop` | `string` | The `--mop` value, when passed. |
| `by` | `"human" \| "mop"` | Who decided. |
| `resolutions` | `{ id, resolution: "fixed" \| "left" }[]` | What finally happened to each finding. |

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

## `slopmop resolve`

Records what finally happened to findings, by id. This is the ground truth for the judge: a `human` verdict the user fixed was slop, and one they left was not. The **Needs your call** table in a mop's report gives each finding's id.

```text
slopmop resolve --run <id> [--mop <name>] [--by human|mop] <finding-id>=<fixed|left> ...
```

| Flag | Description |
| --- | --- |
| `--run <id>` | Required. The run the findings came from, so ids join to that run's `judge` event. |
| `--mop <name>` | The mop that reported them. |
| `--by` | `human` or `mop`. Default: `human`. |

```bash
npx -y slopmop resolve --run code-20261127T101500Z 3f9a1c0e5b7d2a46=fixed 0b1c2d3e4f5a6b7c=left
```

It prints the file it wrote to, or `telemetry is off`. A missing `--run`, no pairs, a bad `--by`, or a pair that is not a 16-character hex id and `fixed` or `left` exits 2. Ids are not checked against earlier events.

## Calibrating in ClickHouse

With full mode shipping to `otel_logs`, join each judged finding to its resolution on run and id. This compares the model's `slop` probability with how often people actually fixed the finding:

```sql
WITH
  judged AS (
    SELECT LogAttributes['mop.run'] AS run, JSONExtractString(f, 'id') AS id,
           JSONExtractString(f, 'rule') AS rule, JSONExtractFloat(f, 'probabilities', 'slop') AS slop
    FROM otel_logs ARRAY JOIN JSONExtractArrayRaw(Body, 'findings') AS f
    WHERE LogAttributes['event.name'] = 'mop.judge'
  ),
  resolved AS (
    SELECT LogAttributes['mop.run'] AS run, JSONExtractString(r, 'id') AS id,
           JSONExtractString(r, 'resolution') = 'fixed' AS fixed
    FROM otel_logs ARRAY JOIN JSONExtractArrayRaw(Body, 'resolutions') AS r
    WHERE LogAttributes['event.name'] = 'mop.resolve'
  )
SELECT round(slop, 1) AS predicted, count() AS findings, avg(fixed) AS observed
FROM judged INNER JOIN resolved USING (run, id)
GROUP BY predicted ORDER BY predicted
```

Findings the mop fixed itself need no `resolve`: their id is in the run's first `lint` and missing from its last.

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
| `enforce`, `waive`, `human`, `unjudged` | Judge verdicts across every `judge`. |
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
- **Resolve from a report**: the **Needs your call** table. [Learn more](../../plugins/mop/JUDGE.md#needs-your-call)
- **Source**: the recorder and the summary, and the OTLP sender. [Learn more](../../src/telemetry.ts), [OTLP](../../src/otlp.ts)
