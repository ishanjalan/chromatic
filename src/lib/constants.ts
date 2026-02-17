/**
 * TARGET_CURVE — Oklch L and C targets for each shade level.
 *
 * L values: APCA-optimised so every shade passes its designated text
 * contrast requirements (Grey 750 for light fills, Grey 50 for dark fills).
 *   - Shade 200 L raised from 0.7258 → 0.7900 (was failing APCA Lc 60 for
 *     Grey 750 Primary text even on highly chromatic hues like Fuchsia/Magenta;
 *     now passes comfortably for all 12 hue families, worst-case Lc ≈ 48).
 *   - All other L values validated against APCA and remain unchanged.
 *
 * C values: derived from the mean chroma of gamut-unconstrained families
 * in the existing palette (i.e. families where actual C < 90% of
 * maxChromaAtLH). These are fixed targets — the generator does NOT
 * proportionally scale chroma from the 300 anchor. Instead, each shade
 * gets its fixed C target, which is then gamut-clamped per hue.
 *
 * L_300 and C_300 are reference values only; the actual 300 shade uses
 * the user's input hex.
 */
export const TARGET_CURVE: Record<number, { L: number; C: number }> = {
	50:  { L: 0.9417, C: 0.0335 },
	100: { L: 0.9138, C: 0.0842 },
	200: { L: 0.7900, C: 0.1238 },
	300: { L: 0.5387, C: 0.1729 },
	400: { L: 0.3550, C: 0.0999 },
	500: { L: 0.3276, C: 0.0548 },
};

export const SHADE_LEVELS = [50, 100, 200, 300, 400, 500] as const;
export type ShadeLevel = (typeof SHADE_LEVELS)[number];

/**
 * Achromatic detection threshold (Oklch chroma).
 *
 * Inputs with C < this value are treated as neutral/achromatic — the
 * generator will force chroma to 0 for all shades, producing a pure grey
 * ramp instead of tinting at the residual phantom hue (~90° yellow axis)
 * that Oklch assigns to achromatic sRGB values.
 */
export const ACHROMATIC_THRESHOLD = 0.01;

/**
 * Shade role mapping for light and dark mode.
 * Based on the semantic token structure in the design system.
 */
export const SHADE_ROLES: Record<number, { light: string; dark: string }> = {
	50: { light: 'Tertiary', dark: '' },
	100: { light: 'Secondary', dark: '' },
	200: { light: '', dark: 'Primary' },
	300: { light: 'Primary', dark: '' },
	400: { light: '', dark: 'Secondary' },
	500: { light: '', dark: 'Tertiary' }
};

/**
 * Design system text colours from Value.tokens.json.
 *
 * Light mode uses Grey/750 (#1D1D1D) as the base text colour,
 * with alpha variants for secondary (69%) and tertiary (62%).
 *
 * Dark mode uses Grey/50 (#FDFDFD) as the base text colour,
 * with alpha variants for secondary (72%) and tertiary (64%).
 */
export interface TextLevel {
	label: string;
	r: number;
	g: number;
	b: number;
	alpha: number;
}

const GREY_750 = { r: 0.1137, g: 0.1137, b: 0.1137 }; // #1D1D1D
const GREY_50  = { r: 0.9922, g: 0.9922, b: 0.9922 }; // #FDFDFD

export const TEXT_LEVELS_GREY750: TextLevel[] = [
	{ label: 'Primary',   ...GREY_750, alpha: 1.00 },
	{ label: 'Secondary', ...GREY_750, alpha: 0.69 },
	{ label: 'Tertiary',  ...GREY_750, alpha: 0.62 },
];

export const TEXT_LEVELS_GREY50: TextLevel[] = [
	{ label: 'Primary',   ...GREY_50, alpha: 1.00 },
	{ label: 'Secondary', ...GREY_50, alpha: 0.72 },
	{ label: 'Tertiary',  ...GREY_50, alpha: 0.64 },
];

/**
 * Which text token set is the ACTIVE foreground for each shade.
 *
 * Tertiary/Secondary fills use "standard" text for their mode:
 *   50, 100 (light fills) → Grey 750 (dark standard text)
 *   400, 500 (dark fills) → Grey 50 (light standard text)
 *
 * Primary fills use "inverse" text (the opposite token):
 *   300 (light primary, saturated bg) → Grey 50 (light inverse text)
 *   200 (dark primary, lighter bg)    → Grey 750 (dark inverse text)
 */
export const SHADE_ACTIVE_TEXT: Record<number, 'grey750' | 'grey50'> = {
	50:  'grey750',
	100: 'grey750',
	200: 'grey750',  // inverse text in dark mode
	300: 'grey50',   // inverse text in light mode
	400: 'grey50',
	500: 'grey50'
};

/**
 * Semantic label for why this text token is used on this shade.
 */
export const SHADE_TEXT_SEMANTIC: Record<number, string> = {
	50:  'Standard',
	100: 'Standard',
	200: 'Inverse',
	300: 'Inverse',
	400: 'Standard',
	500: 'Standard'
};
