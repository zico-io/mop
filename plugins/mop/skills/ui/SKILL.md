---
name: ui
description: "Slop mop for UI: scans a branch's changed components with Impeccable's design detector, fixes the anti-patterns it finds (layout-property animation, default-styled browser surfaces, low contrast, hard offset shadows, gradient text, generic card grids) within the existing design system, and confirms in the rendered app. Use when the user says UI slop, design slop, detector findings, this looks AI-generated, janky animation, or /mop:ui. Not for redesigns or polish passes (use /impeccable polish). Usage - /mop:ui, /mop:ui main, /mop:ui http://localhost:3000/settings --no-commit"
---

Remove the design slop a branch added, without redesigning anything.

**Arguments:** `$ARGUMENTS`
- `BASE_REF` or a path, as for the other mops. A URL scans the rendered page instead.
- `--no-commit`: stop after verification.

## Steps

1. **Scope.** Changed `.tsx`, `.jsx`, `.css` and `.html` files that render UI. Skip tests.

2. **Detect.** Run the Impeccable detector (requires the `impeccable` plugin). Find it first; no match means the plugin is missing, so stop and say so:
   ```bash
   IMPECCABLE=$(find ~/.claude/plugins/cache -path '*impeccable*/scripts/impeccable' -type f | sort | tail -1)
   "$IMPECCABLE" detect --json <files>
   ```
   Pass paths through `xargs -0` or quote them: route folders such as `(authenticated)` and `[[...slug]]` break word splitting. Keep findings whose line the branch changed; list the rest as pre-existing.

3. **Fix within the system.** Use the project's tokens and shared components. Do not change copy, layout intent, or behaviour. Fix each finding with the matching row in [REFERENCE.md](REFERENCE.md#fixes).

4. **Verify in the app.** Rerun the detector to zero new findings. Then render the changed surfaces at desktop and mobile widths with the browser tooling available (T3 preview, Playwright, or the cmux browser) and check light and dark themes once. If the app needs a login you cannot get, say so and list what to check by eye.

5. **Commit** unless `--no-commit`. Push only when asked.

## Definition of done

- [ ] The detector reports zero findings on lines the branch changed, or each one left is listed with a reason.
- [ ] Every fix uses the project's existing tokens and components; no new colours, spacing values or one-off components.
- [ ] Copy, layout intent and behaviour are unchanged.
- [ ] The changed surfaces were seen rendered at desktop and mobile widths and in light and dark themes, or the report says why not and lists what to check by eye.
- [ ] Typecheck and the touched suites pass, apart from failures listed as pre-existing on `BASE_REF`.

## Gotchas

- A clean detector run is not proof of quality. It catches mechanics, not hierarchy or taste.
- Authenticated pages may need a minted session; do not guess credentials.
