# Logging a mop run

`slopmop lint`, `judge` and `record` append rule ids, paths, counts, verdicts and timings to a local file, never file contents. `slopmop stats` summarizes it, so the mops and the config can be tuned from real runs. `MOP_TELEMETRY=0` turns it off; the steps below still run and write nothing.

## Run id

Use one run id for every `slopmop` call in a run. Take the `--run` argument when one was passed, as `/mop` does for each mop. Otherwise make one once at the start, from the mop name and the UTC time:

```bash
echo "code-$(date -u +%Y%m%dT%H%M%SZ)"
```

Pass it as `--run <id>` to every `slopmop lint` and `slopmop judge` call, including the rerun during verification. `stats` reads the first `lint` of a run as the before count and the last as the after count.

## Record the outcome

After the report, record what the mop did with the counts from that report:

```bash
npx -y slopmop record --mop <code|tests|docs|ui|break> --run <id> --outcome <done|failed> --fixed <n> --left <n> --human <n>
```

| Flag | Value |
|---|---|
| `--outcome` | `failed` when verification did not pass, else `done`. |
| `--fixed` | Findings fixed. |
| `--left` | Findings left on purpose: config `leave` and Jev `waive`. |
| `--human` | Rows under **Needs your call**. |

Record once per mop, even under `--no-commit`. A failed `record` never blocks the report.
