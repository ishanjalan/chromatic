# Chromatic

**Colour intelligence for design systems.**

Generate, audit, and optimise design system colour palettes using a fully programmatic pipeline grounded in perceptual colour science. No per-hue hand-tuning — every shade is derived from your input hex, the physics of the sRGB gamut, and human visual perception models.

## What it does

- **Generate** — Enter any hex colour and produce a 6-shade scale (50–500) with perceptually uniform lightness and APCA-compliant contrast. Every parameter is derived, not hand-tuned.
- **Audit** — Upload Figma-exported design tokens and get a full palette health report: chroma normalisation scores, hue collision detection, proximity warnings, and shade-by-shade optimisation suggestions.
- **Compare** — View existing vs. proposed scales side-by-side with per-shade colour deltas, inline hex values, and click-to-copy.
- **Expand** — Get ranked suggestions for new colour families to fill hue gaps, sourced from Tailwind CSS v4, Adobe Spectrum 2, and Radix Colors canonical palettes with chroma compatibility scoring.
- **Preview** — See your palette applied to Material 3 Expressive-inspired UI components (buttons, cards, forms, alerts, badges) in both light and dark mode.
- **Simulate** — Check your scales under protanopia, deuteranopia, and tritanopia colour vision deficiency simulations (Brettel/Viénot matrices).
- **Diagnose** — Export a comprehensive JSON snapshot of all engine parameters, generated shades, APCA compliance, hue drift, chroma utilisation, and per-shade reference system comparisons.
- **Share** — Copy a shareable URL that encodes your full workspace for teammates to review.

## Colour science pipeline

Chromatic's generation engine chains six stages, each feeding into the next. The entire pipeline runs for any arbitrary hex input with **zero per-hue constants**.

### 1. APCA-derived lightness targets

Shade lightness values are not hand-picked. The engine binary-searches for the exact Oklch L where an achromatic fill achieves |Lc| = 75 (or 60 for shade 200) against the design system's text tokens under APCA. A per-shade headroom offset is then added for aesthetic breathing room. Changing your text colour auto-recalibrates the entire lightness curve.

### 2. CAM16 hue correction (Abney effect compensation)

Human colour perception shifts hue as lightness changes — a blue at L=0.95 doesn't look the same hue as the same Oklch H at L=0.30. Chromatic implements a minimal CIE CAM16 forward model (Hunt-Pointer-Estévez chromatic adaptation, D65 illuminant, average surround viewing conditions) and binary-searches for the Oklch hue at each shade's lightness that preserves the same CAM16 perceptual hue as the anchor, with a 15-degree drift cap to maintain hue family identity.

### 3. Cusp-aware gamut-width normalisation

The sRGB gamut varies wildly by hue — green has 6.7x the available chroma of blue at high lightness. A naive uniform chroma fraction produces neon greens and pale blues. Chromatic computes the **gamut cusp** (the lightness where sRGB is widest for each hue) and adapts compression based on distance from the cusp:

```
damping = clamp(0.70 + 2.0 × |L − cuspL(H)|, 0.1, 1.0)
```

Near the cusp → more compression (restrain wide-gamut hues). Far from the cusp → less compression (use available gamut). This was calibrated against 17 Tailwind hues × 7 shade levels via grid search and achieves lower cross-hue chroma variance (CV 12.5%) than Tailwind's hand-tuned palette (CV 15.8%).

### 4. Relative chroma targeting

Chroma is expressed as a fraction of the gamut-normalised maximum, with an equal-step progression tied to semantic roles:

| Role | Shades | relC |
|------|--------|------|
| Tertiary | 50, 500 | 0.55, 0.70 |
| Secondary | 100, 400 | 0.75, 0.80 |
| Primary | 200 | 0.90 |
| Anchor | 300 | User's input chroma (preserved) |

Dark fills (400, 500) get an asymmetric boost for richer appearance at low lightness.

### 5. Helmholtz-Kohlrausch compensation

Saturated colours appear brighter than their measured luminance suggests. The engine reduces effective lightness proportionally to chroma (`L_eff = L − 0.04 × C`) for non-anchor shades, preventing high-chroma fills from looking washed out relative to their grey equivalent.

### 6. Gamut clamping and safety net

Final chroma is clamped to the sRGB gamut boundary at the H-K-adjusted lightness, with a re-clamp after lightness adjustment to catch edge cases.

## Reference system alignment

Chromatic stores canonical colour data from three industry-standard systems for comparison:

- **Tailwind CSS v4** — 17 families, 11 shades each (shade 700 used as anchor-equivalent)
- **Radix Colors** — 24 families, 12 steps each (step 9 used as anchor-equivalent)
- **Adobe Spectrum 2** — 17 families, 13 shades each (shade 900 used as anchor-equivalent)

The audit engine computes per-shade chroma ratios against the closest-by-lightness reference shade, giving you a concrete measure of how your palette compares to battle-tested systems used by millions.

## Tech stack

- [SvelteKit 2](https://svelte.dev/docs/kit) with [Svelte 5](https://svelte.dev) runes
- [Tailwind CSS v4](https://tailwindcss.com)
- [Vitest](https://vitest.dev) + [Svelte Testing Library](https://testing-library.com/docs/svelte-testing-library/intro)
- TypeScript throughout — all colour math implemented from spec, no external colour libraries
- Deployed on [Vercel](https://vercel.com) with GitHub CI

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5199](http://localhost:5199).

## Scripts

| Command              | Description                        |
| -------------------- | ---------------------------------- |
| `npm run dev`        | Start dev server                   |
| `npm run build`      | Production build                   |
| `npm run preview`    | Preview production build locally   |
| `npm test`           | Run all tests (361 tests)          |
| `npm run test:watch` | Run tests in watch mode            |
| `npm run check`      | Svelte type checking               |
| `npm run format`     | Format all files with Prettier     |

## License

Internal tool. Not licensed for redistribution.
