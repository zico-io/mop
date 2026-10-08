# Judging findings with Jev

Every mop asks Jev, through the `jev` CLI from TypeSafe, whether each finding should be enforced before fixing it. Jev answers three yes-or-no questions per finding: is it real slop, does the code around it follow the pattern on purpose, and could the fix change behaviour, copy, an API or a test. `judge` turns the answers into a verdict and only acts on answers Jev is at least 90% sure of.

## Run

Write the findings as a JSON array of `{file, line, rule, message}`. `lint --json` output works as it is.

```bash
npx -y -p mop-harness judge --mop <code|ui|tests|docs> --json /tmp/mop-<mop>-findings.json > /tmp/mop-<mop>-judged.json
```

It runs `jev batch` once for all findings, so it needs `jev` on the `PATH` with a key (`jev auth status`; `jev doctor` checks the round trip). `JEV_ENABLED=0` turns judging off.

## Act on the verdict

| Verdict | Do |
|---|---|
| `enforce` | Fix it. |
| `waive` | Leave it. List it under "left on purpose" with the `why`. |
| `human` | Leave it untouched. Add it to **Needs your call**. |
| `unjudged` | Jev was unavailable or failed. Fall back to the mop's own sort and say in the report that Jev was skipped. |

Jev never overrides a config `leave`, a rule the user gave, or a mop's definition of done. A finding the mop would refuse to fix stays unfixed whatever Jev says.

## Needs your call

End the report with this section when any finding is `human`, one row per finding:

| Where | Rule | Finding | Why it needs you |
|---|---|---|---|
| `file:line` | rule | the finding, in a few words | the `why`, plus the deciding probabilities |

Group identical rule-and-reason rows into one with a count. The user's answer is applied in a follow-up commit, not guessed at now.
