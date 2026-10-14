---
"slopmop": patch
---

`slopmop judge` sends each finding to Jev with `jev run -`, which jev-cli 0.7 supports, instead of `jev batch`, which no published jev CLI provides. When Jev judges none of the findings, `judge` prints one warning with the cause.
