# Judging findings

Every mop asks a decisions model, through `slopmop judge`, whether each finding should be enforced before fixing it. The model is TypeSafe's Jev by default and set by the `judge` key of `mop.config`. It answers three yes-or-no questions per finding: is it real slop, does the code around it follow the pattern on purpose, and could the fix change behaviour, copy, an API or a test. `judge` turns the answers into a verdict and only acts on answers the model is at least 90% sure of.

## Run

Write the findings as a JSON array of `{file, line, rule, message}`. `slopmop lint --json` output works as it is.

```bash
npx -y slopmop judge --mop <code|ui|tests|docs> --run <id> --json /tmp/mop-<mop>-findings.json > /tmp/mop-<mop>-judged.json
```

It sends one decisions API request per finding to the provider in the `judge` key of `mop.config`, so it needs that provider's API key in the environment: `TYPESAFE_API_KEY` by default. `MOP_JUDGE=0` turns judging off. `--run` is the run id from [TELEMETRY.md](TELEMETRY.md).

## Act on the verdict

| Verdict | Do |
|---|---|
| `enforce` | Fix it. |
| `waive` | Leave it. List it under "left on purpose" with the `why`. |
| `human` | Leave it untouched. Add it to **Needs your call**. |
| `unjudged` | The model was unavailable or failed. Fall back to the mop's own sort and say in the report that judging was skipped. |

The judge never overrides a config `leave`, a rule the user gave, or a mop's definition of done. A finding the mop would refuse to fix stays unfixed whatever the judge says.

## Needs your call

End the report with this section when any finding is `human`, one row per finding:

| Where | Rule | Finding | Why it needs you |
|---|---|---|---|
| `file:line` | rule | the finding, in a few words | the `why`, plus the deciding probabilities |

Group identical rule-and-reason rows into one with a count. The user's answer is applied in a follow-up commit, not guessed at now.
