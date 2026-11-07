---
"slopmop": patch
---

`slopmop lint` no longer crashes when Tailwind is on but cannot load. Before, a `tailwind` config without an `entryPoint` (which `slopmop init` writes when you leave the entry point blank) threw a TypeError, and an entry point where `tailwindcss` does not resolve, such as an `npx` run in a repo without it installed, threw "Could not resolve tailwindcss" and stopped the whole lint. Now the lint prints a warning, skips only the Tailwind rules, and checks everything else. Repos with a valid entry point and `tailwindcss` installed lint as before. (#24)
