---
title: mop-judge
description: mop-judge input, Jev questions, verdict rules, output format and the judge() API.
type: reference
updated: 2026-10-08
owner: zico-io
---

`mop-judge` asks Jev whether each finding should be fixed, and returns a verdict for each one.

```bash
npx -y -p mop-harness mop-lint --base main --json > findings.json
npx -y -p mop-harness mop-judge --mop code findings.json
```

```text title="Output"
4 enforce, 2 waive, 1 human
human  src/cart.ts:42  sonarjs/no-nested-conditional  the fix could change behaviour, copy, an API or a test
```

## Usage

```text
mop-judge [--mop <name>] [--json] [<file>]
```

| Argument | Description |
| --- | --- |
| `<file>` | JSON input. When absent, `mop-judge` reads stdin. |
| `--mop <name>` | Mop name sent to Jev as context: `code`, `ui`, `tests` or `docs`. A finding's own `mop` field wins. Default: `code`. |
| `--json` | Print counts and every judged finding as JSON. |

### Environment

| Variable | Effect |
| --- | --- |
| `JEV_ENABLED=0` | Skip Jev. Every finding is `unjudged`. |

`mop-judge` needs the `jev` CLI on the `PATH` with a key. Run `jev auth status` to check the key.

## Input

A JSON array of findings, or an object with a `findings` array, as `mop-lint --json` prints.

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `rule` | `string` | Yes | Rule id or detector name. |
| `message` | `string` | Yes | What is wrong. |
| `file` | `string` | No | Path from the git root, as `mop-lint` writes it. Outside a git repository, from the current directory. |
| `line` | `number` | No | 1-based line. |
| `snippet` | `string` | No | Code to show Jev. When absent, `mop-judge` reads 4 lines on each side of `line` from `file`. |
| `mop` | `string` | No | Overrides `--mop` for this finding. |

Other properties pass through to the output.

## How a verdict is chosen

`mop-judge` sends all findings in one `jev batch` call, with up to 8 in flight. Jev answers three yes-or-no questions per finding, each as a probability:

| Question | Yes means |
| --- | --- |
| `slop` | The finding is real, and a careful reviewer would ask for the change. |
| `deliberate` | The surrounding code follows the flagged pattern on purpose. |
| `risky` | The fix could change behavior, copy, layout, a public API, a file format, or a test's assertions. |

An answer is sure when its probability is at least `0.9` or at most `0.1`. The rules run in this order, and the first match wins:

| Check | Verdict | `why` |
| --- | --- | --- |
| `slop` not sure | `human` | Jev is unsure whether this is slop |
| `slop` is no | `waive` | not slop on this line |
| `deliberate` not sure | `human` | Jev is unsure whether the pattern is deliberate here |
| `deliberate` is yes | `waive` | the code around it follows this pattern on purpose |
| `risky` not sure, or yes | `human` | the fix could change behaviour, copy, an API or a test |
| Otherwise | `enforce` | real slop with a mechanical fix |

When `jev` fails or returns no answer for a finding, that finding is `unjudged`, and `why` holds the error.

## Output

Text output prints the verdict counts, then one line for each `human` finding: `human  <file>:<line>  <rule>  <why>`.

JSON output:

| Property | Type | Description |
| --- | --- | --- |
| `counts` | `Partial<Record<Verdict, number>>` | Findings per verdict. |
| `findings` | `Judged[]` | Each input finding, plus `verdict`, `why`, and `probabilities` when Jev answered. |

`probabilities` has the keys `slop`, `deliberate` and `risky`, rounded to two decimals.

The exit code is `0` unless the input cannot be read or parsed. A Jev failure does not change it.

## `judge()`

`judge(findings, { root, run })` in `src/judge.ts` does the work behind the CLI. It is internal: the package entry does not export it. `run` replaces the `jev batch` call, so tests pass a fake, as `test/judge.test.ts` does.

## Don't

- Don't read `unjudged` as `waive`. It means nobody judged the finding. The mops fall back to the config sort and say so.
- Don't treat a verdict as an override. A config `leave` and the mop's own rules still win over `enforce`.

## Next steps

- **Act on verdicts**: what each mop does with them. [Learn more](../../plugins/mop/JUDGE.md)
- **Produce findings**: `mop-lint --json`. [Learn more](mop-lint.md)
- **Jev errors**: `unjudged` causes and fixes. [Learn more](../troubleshooting.md)
- **Source**: the questions and `verdictOf`. [Learn more](../../src/judge.ts)
