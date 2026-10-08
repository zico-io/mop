---
"mop-harness": patch
---

`mop-judge` reads snippets from the git root, where `mop-lint` paths start. Run from a subdirectory, it used to send Jev an empty snippet for every finding.
