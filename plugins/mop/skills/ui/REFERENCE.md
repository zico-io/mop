# mop:ui reference

## Fixes

| Finding | Fix |
|---|---|
| Layout-property animation | Animate `transform` or `opacity` instead of `width`, `height` or `padding` |
| Default-styled browser surfaces | Theme focus rings, scrollbars and selection from the palette |
| Hard offset shadow | Replace it with an offset, soft-blur shadow from the project's tokens |
| Low contrast | Move to the token pair the design system uses for that surface |
| Gradient text, generic card grids | Use the project's existing text and layout components |

```css
/* before */
.panel { transition: height 200ms; }
/* after */
.panel { transition: transform 200ms, opacity 200ms; }
```

Every fix uses existing tokens and components. No new colours, spacing values or one-off components.
