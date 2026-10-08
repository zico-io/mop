# slopmop

## 0.2.0

### Minor Changes

- [#8](https://github.com/zico-io/mop/pull/8) [`bba723e`](https://github.com/zico-io/mop/commit/bba723e4b7a9a7e5fcdcd6d901a00c4132454481) Thanks [@zico-io](https://github.com/zico-io)! - Breaking: the package is now `slopmop`, with one `slopmop` command. `mop-lint` is now `slopmop lint`, and `mop-judge` is now `slopmop judge`. Run them as `npx -y slopmop lint` and `npx -y slopmop judge`. Flags and output are unchanged. Install the library with `pnpm add -D slopmop` and import from `"slopmop"`.

### Patch Changes

- [#8](https://github.com/zico-io/mop/pull/8) [`fd3a4bf`](https://github.com/zico-io/mop/commit/fd3a4bfc2a9753a64dfc1aa168f4ca5df4d7ce75) Thanks [@zico-io](https://github.com/zico-io)! - `judge` reads snippets from the git root, where `lint` paths start. Run from a subdirectory, it used to send Jev an empty snippet for every finding.

- [#8](https://github.com/zico-io/mop/pull/8) [`a5fa33b`](https://github.com/zico-io/mop/commit/a5fa33b2cac61f5a41695876560034fbacff3b29) Thanks [@zico-io](https://github.com/zico-io)! - `lint` labels notices about inline `eslint-` comments `eslint-directive` instead of `parse-error`, which now means only a file ESLint could not parse.
