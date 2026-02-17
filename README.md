# Chromatic

**Colour intelligence for design systems.**

Generate, audit, and optimise design system colour palettes using Oklch perceptual colour science and APCA contrast compliance.

## What it does

- **Generate** — Enter any hex colour and produce a 6-shade scale (50-500) with perceptually uniform lightness and APCA-compliant contrast.
- **Audit** — Upload your Figma-exported design tokens and get a full palette health report: chroma normalisation, hue collision detection, and shade-by-shade optimisation suggestions.
- **Compare** — View existing vs. proposed scales side-by-side with per-shade colour deltas and inline hex values.
- **Expand** — Get suggestions for new colour families to fill hue gaps, sourced from Tailwind v4 and Adobe Spectrum 2 reference palettes.
- **Preview** — See your palette applied to realistic UI components (buttons, cards, forms, alerts, badges) in both light and dark mode.
- **Simulate** — Check your scales under protanopia, deuteranopia, and tritanopia colour vision deficiency simulations.
- **Share** — Copy a shareable URL that encodes your full workspace (scales + locked families) for teammates to review.

## Tech stack

- [SvelteKit 2](https://svelte.dev/docs/kit) with [Svelte 5](https://svelte.dev) runes
- [Tailwind CSS v4](https://tailwindcss.com)
- [Vitest](https://vitest.dev) + [Svelte Testing Library](https://testing-library.com/docs/svelte-testing-library/intro)
- TypeScript throughout
- Deployed on [Vercel](https://vercel.com)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

| Command              | Description                        |
| -------------------- | ---------------------------------- |
| `npm run dev`        | Start dev server                   |
| `npm run build`      | Production build                   |
| `npm run preview`    | Preview production build locally   |
| `npm test`           | Run all tests                      |
| `npm run test:watch` | Run tests in watch mode            |
| `npm run check`      | Svelte type checking               |
| `npm run format`     | Format all files with Prettier     |

## Colour science

Chromatic uses the **Oklch** perceptual colour space for all scale generation. Lightness targets for each shade are derived from APCA (Accessible Perceptual Contrast Algorithm) optimal values, ensuring body text meets Lc >= 60 contrast against the design system's Grey 750 / Grey 50 text tokens.

Chroma targets are normalised across families using relative chroma (actual chroma / gamut-maximum chroma at that lightness and hue), so all colour families appear perceptually equal in vibrancy.

## License

Internal tool. Not licensed for redistribution.
