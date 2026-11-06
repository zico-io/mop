# slopmop-eve

## 0.2.0

### Minor Changes

- [#22](https://github.com/zico-io/mop/pull/22) [`8b90493`](https://github.com/zico-io/mop/commit/8b904935ce1eb061e53760e49a2d9224ec8015c1) Thanks [@zico-io](https://github.com/zico-io)! - Build the eve extension with eve 1.0 (`1.0.0-rc.6`). Agents need eve 1.0.0-rc.6 or later to load this release, because eve checks the version that built an extension.

- [#20](https://github.com/zico-io/mop/pull/20) [`a8203c7`](https://github.com/zico-io/mop/commit/a8203c7b2f66b59b3c30d53a085ddc7a79182794) Thanks [@zico-io](https://github.com/zico-io)! - Record mop runs locally so they can be analyzed and tuned. `slopmop lint`, `judge` and the new `record` command append rule ids, paths, counts, verdicts and timings to `~/.local/state/mop/runs.jsonl`, never file contents, and nothing is sent anywhere. `slopmop stats` summarizes the file per rule: findings, config action, Jev verdicts, how many the mops cleared, and which rules to move into `mop.fix` or `mop.leave`. `lint` and `judge` take `--run <id>` to group a run's events, every mop now passes one and ends with `slopmop record`, and `MOP_TELEMETRY=0` turns recording off.

- [#21](https://github.com/zico-io/mop/pull/21) [`e568599`](https://github.com/zico-io/mop/commit/e568599289c511d61f4dbee41520f42bd6f0b8e6) Thanks [@zico-io](https://github.com/zico-io)! - Rename the `/mop:mop` command to `/mop:slop`. The eve skill is now `slopmop__slop`.

### Patch Changes

- [#23](https://github.com/zico-io/mop/pull/23) [`d32d4d6`](https://github.com/zico-io/mop/commit/d32d4d6c9778719478adf8b9682ef170ce8f1ffe) Thanks [@zico-io](https://github.com/zico-io)! - Mount the eve extension as `agent/extensions/mop.ts`, so the skills are named `mop__slop`, `mop__code` and so on, matching `/mop:<name>`.

- [#21](https://github.com/zico-io/mop/pull/21) [`e568599`](https://github.com/zico-io/mop/commit/e568599289c511d61f4dbee41520f42bd6f0b8e6) Thanks [@zico-io](https://github.com/zico-io)! - `/mop:tests` subagents make their edits themselves instead of handing them to another agent such as `codex exec`. Nested agents took 45 seconds to 10 minutes per test file.

## 0.1.0

### Minor Changes

- [#12](https://github.com/zico-io/mop/pull/12) [`f939f2c`](https://github.com/zico-io/mop/commit/f939f2c26eba36bfb162760955399d313740ae6a) Thanks [@zico-io](https://github.com/zico-io)! - Ship the mop skills as an eve extension, `slopmop-eve`. Mount it in an eve agent with `export { default } from "slopmop-eve"`.
