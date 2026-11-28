# slopmop

## 0.6.0

### Minor Changes

- [#29](https://github.com/zico-io/mop/pull/29) [`947f208`](https://github.com/zico-io/mop/commit/947f208d1c8ee968837ec57efa048d970a5f975f) Thanks [@zico-io](https://github.com/zico-io)! - feat: opt-in full telemetry shipped over OTLP, and `slopmop resolve` for judge ground truth
  
  - `MOP_TELEMETRY=full` also sends every event to an OTLP collector over `http/json`, `http/protobuf` or `grpc`, with finding messages, snippets and `why`. The local file stays content-free. The release has a built-in collector, sent no credentials; `MOP_OTLP_ENDPOINT`, with `MOP_OTLP_HEADERS` and `MOP_OTLP_PROTOCOL`, points it at your own instead.
  - New `slopmop resolve --run <id> <finding-id>=fixed|left ...` records what finally happened to findings, so judge probabilities can be calibrated against real outcomes.
  - Findings get a stable `id` in `lint --json`, `judge --json` and telemetry. Judge probabilities are no longer rounded.
  - Events move to schema `v: 2` and add `version`, `origin`, and on `judge`, `auto` and `configHash`.

## 0.5.0

### Minor Changes

- [#26](https://github.com/zico-io/mop/pull/26) [`e38564d`](https://github.com/zico-io/mop/commit/e38564dbcf60934d23d18ca7cf792db94b7dac8c) Thanks [@zico-io](https://github.com/zico-io)! - `slopmop judge` calls a decisions API itself instead of shelling out to the `jev` CLI, so jev-cli is no longer needed, and the decisions model is no longer tied to Jev. The new `judge` key in `mop.config` picks the provider (`typesafe` by default, or `openrouter`, `vercel`, `cloudflare` or `custom`) and can override its `endpoint`, `model` and `apiKeyVariable`, so `{ "provider": "cloudflare", "model": "clef" }` asks Cloudflare's Clef. Each provider reads its API key from the environment, `TYPESAFE_API_KEY` by default. `MOP_JUDGE=0` replaces `JEV_ENABLED=0`, and the `judge` telemetry event records `judge: { provider, model }` instead of `jev: true`.

### Patch Changes

- [#28](https://github.com/zico-io/mop/pull/28) [`4dfee1b`](https://github.com/zico-io/mop/commit/4dfee1b7c5027bce952db4e0bbc1c1a6f1354a9e) Thanks [@zico-io](https://github.com/zico-io)! - `/mop:ui` finds the Impeccable detector when Impeccable is installed as a user skill in `~/.claude/skills/impeccable`, not only as a plugin in `~/.claude/plugins/cache`.

## 0.4.1

### Patch Changes

- [#24](https://github.com/zico-io/mop/pull/24) [`03c2799`](https://github.com/zico-io/mop/commit/03c2799d6377d78b769f6f772fef803782a6d344) Thanks [@zico-io](https://github.com/zico-io)! - `slopmop lint` no longer crashes when Tailwind is on but cannot load. Before, a `tailwind` config without an `entryPoint` (which `slopmop init` writes when you leave the entry point blank) threw a TypeError, and an entry point where `tailwindcss` does not resolve, such as an `npx` run in a repo without it installed, threw "Could not resolve tailwindcss" and stopped the whole lint. Now the lint prints a warning, skips only the Tailwind rules, and checks everything else. Repos with a valid entry point and `tailwindcss` installed lint as before. ([#24](https://github.com/zico-io/mop/issues/24))

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
