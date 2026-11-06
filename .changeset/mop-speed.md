---
"slopmop": patch
"slopmop-eve": patch
---

`/mop:tests` subagents make their edits themselves instead of handing them to another agent such as `codex exec`. Nested agents took 45 seconds to 10 minutes per test file.
