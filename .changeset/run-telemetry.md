---
"slopmop": minor
"slopmop-eve": minor
---

Record mop runs locally so they can be analyzed and tuned. `slopmop lint`, `judge` and the new `record` command append rule ids, paths, counts, verdicts and timings to `~/.local/state/mop/runs.jsonl`, never file contents, and nothing is sent anywhere. `slopmop stats` summarizes the file per rule: findings, config action, Jev verdicts, how many the mops cleared, and which rules to move into `mop.fix` or `mop.leave`. `lint` and `judge` take `--run <id>` to group a run's events, every mop now passes one and ends with `slopmop record`, and `MOP_TELEMETRY=0` turns recording off.
