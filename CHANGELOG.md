# slopmop

## 0.4.0

### Minor Changes

- [#16](https://github.com/zico-io/mop/pull/16) [`3b905e4`](https://github.com/zico-io/mop/commit/3b905e4758e26709ffaeab80d39c09d9c8ae78f7) Thanks [@zico-io](https://github.com/zico-io)! - Ship mop as a Codex plugin. Install it with `codex plugin marketplace add zico-io/mop` and `codex plugin add mop@zico-io`.

- [#20](https://github.com/zico-io/mop/pull/20) [`a8203c7`](https://github.com/zico-io/mop/commit/a8203c7b2f66b59b3c30d53a085ddc7a79182794) Thanks [@zico-io](https://github.com/zico-io)! - Record mop runs locally so they can be analyzed and tuned. `slopmop lint`, `judge` and the new `record` command append rule ids, paths, counts, verdicts and timings to `~/.local/state/mop/runs.jsonl`, never file contents, and nothing is sent anywhere. `slopmop stats` summarizes the file per rule: findings, config action, Jev verdicts, how many the mops cleared, and which rules to move into `mop.fix` or `mop.leave`. `lint` and `judge` take `--run <id>` to group a run's events, every mop now passes one and ends with `slopmop record`, and `MOP_TELEMETRY=0` turns recording off.

- [#21](https://github.com/zico-io/mop/pull/21) [`e568599`](https://github.com/zico-io/mop/commit/e568599289c511d61f4dbee41520f42bd6f0b8e6) Thanks [@zico-io](https://github.com/zico-io)! - Rename the `/mop:mop` command to `/mop:slop`. The eve skill is now `slopmop__slop`.

### Patch Changes

- [#19](https://github.com/zico-io/mop/pull/19) [`d036652`](https://github.com/zico-io/mop/commit/d036652cf0443df481fe1ec3e26909fa702691a7) Thanks [@zico-io](https://github.com/zico-io)! - `slopmop judge` sends each finding to Jev with `jev run -`, which jev-cli 0.7 supports, instead of `jev batch`, which no published jev CLI provides. When Jev judges none of the findings, `judge` prints one warning with the cause.

- [#21](https://github.com/zico-io/mop/pull/21) [`e568599`](https://github.com/zico-io/mop/commit/e568599289c511d61f4dbee41520f42bd6f0b8e6) Thanks [@zico-io](https://github.com/zico-io)! - `/mop:tests` subagents make their edits themselves instead of handing them to another agent such as `codex exec`. Nested agents took 45 seconds to 10 minutes per test file.

## 0.3.0

### Minor Changes

- [#14](https://github.com/zico-io/mop/pull/14) [`b1f288a`](https://github.com/zico-io/mop/commit/b1f288a566c8b6d3670250113ef1c7a64f6e5faa) Thanks [@zico-io](https://github.com/zico-io)! - Add `slopmop init`, which inspects the git repo for Tailwind, Playwright and an env module, then asks about each setting and writes `mop.config.json`. Pass `--yes` to take the detected defaults.

- [#15](https://github.com/zico-io/mop/pull/15) [`9821b44`](https://github.com/zico-io/mop/commit/9821b442c8f3f4ddc4d4cf43de056de9a8e67c4f) Thanks [@zico-io](https://github.com/zico-io)! - `slopmop lint` now mops Python, Go, Rust, Terraform and YAML. Each language runs through its own linter (ruff, staticcheck, clippy, tflint, yamllint) plus a shared `mop/no-comments` check, filtered to the lines the branch added and sorted by `mop.fix` and `mop.leave` like ESLint findings. Tune each linter with the new `linters` config key. A missing linter skips its language and shows under `skipped`.

## 0.2.0

### Minor Changes

- [#8](https://github.com/zico-io/mop/pull/8) [`bba723e`](https://github.com/zico-io/mop/commit/bba723e4b7a9a7e5fcdcd6d901a00c4132454481) Thanks [@zico-io](https://github.com/zico-io)! - Breaking: the package is now `slopmop`, with one `slopmop` command. `mop-lint` is now `slopmop lint`, and `mop-judge` is now `slopmop judge`. Run them as `npx -y slopmop lint` and `npx -y slopmop judge`. Flags and output are unchanged. Install the library with `pnpm add -D slopmop` and import from `"slopmop"`.

### Patch Changes

- [#8](https://github.com/zico-io/mop/pull/8) [`fd3a4bf`](https://github.com/zico-io/mop/commit/fd3a4bfc2a9753a64dfc1aa168f4ca5df4d7ce75) Thanks [@zico-io](https://github.com/zico-io)! - `judge` reads snippets from the git root, where `lint` paths start. Run from a subdirectory, it used to send Jev an empty snippet for every finding.

- [#8](https://github.com/zico-io/mop/pull/8) [`a5fa33b`](https://github.com/zico-io/mop/commit/a5fa33b2cac61f5a41695876560034fbacff3b29) Thanks [@zico-io](https://github.com/zico-io)! - `lint` labels notices about inline `eslint-` comments `eslint-directive` instead of `parse-error`, which now means only a file ESLint could not parse.
