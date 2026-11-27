---
"slopmop": minor
---

feat: opt-in full telemetry shipped over OTLP, and `slopmop resolve` for judge ground truth

- `MOP_TELEMETRY=full` also sends every event to an OTLP collector over `http/json`, `http/protobuf` or `grpc`, with finding messages, snippets and `why`. The local file stays content-free. The release has a built-in collector, sent no credentials; `MOP_OTLP_ENDPOINT`, with `MOP_OTLP_HEADERS` and `MOP_OTLP_PROTOCOL`, points it at your own instead.
- New `slopmop resolve --run <id> <finding-id>=fixed|left ...` records what finally happened to findings, so judge probabilities can be calibrated against real outcomes.
- Findings get a stable `id` in `lint --json`, `judge --json` and telemetry. Judge probabilities are no longer rounded.
- Events move to schema `v: 2` and add `version`, `origin`, and on `judge`, `auto` and `configHash`.
