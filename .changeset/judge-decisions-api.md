---
"slopmop": minor
---

`slopmop judge` calls a decisions API itself instead of shelling out to the `jev` CLI, so jev-cli is no longer needed, and the decisions model is no longer tied to Jev. The new `judge` key in `mop.config` picks the provider (`typesafe` by default, or `openrouter`, `vercel`, `cloudflare` or `custom`) and can override its `endpoint`, `model` and `apiKeyVariable`, so `{ "provider": "cloudflare", "model": "clef" }` asks Cloudflare's Clef. Each provider reads its API key from the environment, `TYPESAFE_API_KEY` by default. `MOP_JUDGE=0` replaces `JEV_ENABLED=0`, and the `judge` telemetry event records `judge: { provider, model }` instead of `jev: true`.
