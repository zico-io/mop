---
"slopmop": minor
---

`slopmop lint` now mops Python, Go, Rust, Terraform and YAML. Each language runs through its own linter (ruff, staticcheck, clippy, tflint, yamllint) plus a shared `mop/no-comments` check, filtered to the lines the branch added and sorted by `mop.fix` and `mop.leave` like ESLint findings. Tune each linter with the new `linters` config key. A missing linter skips its language and shows under `skipped`.
