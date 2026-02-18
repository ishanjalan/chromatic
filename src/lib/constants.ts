import { solveLForApca } from './colour';

// ── APCA-Derived Lightness Targets ──────────────────────────────────
//
// L values are derived programmatically, not hand-tuned. The process:
//   1. solveLForApca finds the exact Oklch L where the designated text
//      colour (Grey 750 or Grey 50) achieves |Lc| = APCA_TARGET_LC
//      against an achromatic fill. This is the "contrast floor."
//   2. SHADE_HEADROOM adds aesthetic breathing room above that floor.
//
// Changing the text colours, Lc target, or headroom automatically
// recalculates all L values — no manual recalibration needed.

/** Minimum APCA |Lc| for primary text on any shade. */
export const APCA_TARGET_LC = 75;

/**
 * Aesthetic headroom above the APCA contrast floor.
 *
 * For light fills: L = lightFloor + headroom  (lighter = more contrast)
 * For dark fills:  L = darkFloor - headroom   (darker = more contrast)
 *
 * These are the ONLY hand-tuned numbers in the curve. Their meaning is
 * self-documenting: "how far above the minimum acceptable contrast does
 * this shade sit?"
 *
 * Larger headroom → more contrast, less colour identity.
 * Smaller headroom → tighter to the floor, more vivid.
 */
export const SHADE_HEADROOM: Record<number, number> = {
	50:  0.065,   // tertiary: reduced from 0.092 to open ~2× more chroma gamut
	100: 0.035,   // secondary: reduced from 0.040 for slightly more gamut
	200: 0.021,   // primary (dark mode): tight — max colour identity
	300: 0.033,   // anchor: slight push below floor for headroom
	400: 0.216,   // secondary (dark): deep enough to separate from 300
	500: 0.291,   // tertiary (dark): very deep — background anchor
};

// ── Derive L targets from APCA floor + headroom ────────────────────

const GREY_750_RGB = { r: 0.1137, g: 0.1137, b: 0.1137 };
const GREY_50_RGB  = { r: 0.9922, g: 0.9922, b: 0.9922 };

const lightFloor = solveLForApca(
	GREY_750_RGB.r, GREY_750_RGB.g, GREY_750_RGB.b,
	APCA_TARGET_LC, 'light-fill'
);
const darkFloor = solveLForApca(
	GREY_50_RGB.r, GREY_50_RGB.g, GREY_50_RGB.b,
	APCA_TARGET_LC, 'dark-fill'
);

// ── Equal-Step Relative Chroma ─────────────────────────────────────
//
// relC = BASE_RELC + rank × RELC_STEP
//   rank 0 = Tertiary  (receding background)
//   rank 1 = Secondary (hover/supporting)
//   rank 2 = Primary   (hero fill)
//
// Ensures equal perceptual jumps between role tiers.

export const BASE_RELC = 0.60;
export const RELC_STEP = 0.20;

const SHADE_RELC_RANK: Record<number, number> = {
	50: 0, 100: 1, 200: 2,
	300: -1,  // sentinel — user's input chroma used
	400: 1, 500: 0,
};

function shadeRelC(shade: number): number {
	const rank = SHADE_RELC_RANK[shade];
	if (rank < 0) return 0;
	return BASE_RELC + rank * RELC_STEP;
}

/**
 * TARGET_CURVE — APCA-derived Oklch L and equal-step relative chroma.
 *
 * ## Lightness (L)
 * Derived from: floor(APCA_TARGET_LC, textColour) ± SHADE_HEADROOM.
 * Light fills (50, 100, 200): L = lightFloor + headroom
 * Dark fills (300, 400, 500): L = darkFloor - headroom
 *
 * ## Chroma (relC)
 * Equal-step progression: relC = BASE_RELC + rank × RELC_STEP.
 * Shade 300 uses relC = 0 as a sentinel — the user's input chroma is
 * preserved by scale.ts.
 *
 * ## H-K Compensation
 * Applied in scale.ts: L_eff = L - HK_COEFF × actualC, compensating
 * for the Helmholtz-Kohlrausch effect.
 */
export const TARGET_CURVE: Record<number, { L: number; relC: number }> = {
	50:  { L: lightFloor + SHADE_HEADROOM[50],  relC: shadeRelC(50) },
	100: { L: lightFloor + SHADE_HEADROOM[100], relC: shadeRelC(100) },
	200: { L: lightFloor + SHADE_HEADROOM[200], relC: shadeRelC(200) },
	300: { L: darkFloor  - SHADE_HEADROOM[300], relC: shadeRelC(300) },
	400: { L: darkFloor  - SHADE_HEADROOM[400], relC: shadeRelC(400) },
	500: { L: darkFloor  - SHADE_HEADROOM[500], relC: shadeRelC(500) },
};

/**
 * Reference absolute chroma for the 300 anchor shade.
 *
 * Used by gap-analysis and colour-match modules to generate preview hexes.
 * Derived from the mean of gamut-unconstrained families in the original
 * design system audit.
 */
export const ANCHOR_REF_CHROMA = 0.1729;

/**
 * Helmholtz-Kohlrausch lightness compensation coefficient.
 *     L_effective = L_target - HK_COEFF × actualC
 * Calibrated so the maximum L reduction is ~0.007 (at C ≈ 0.17).
 */
export const HK_COEFF = 0.04;

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
 * Maximum number of colour families in a design system palette.
 *
 * 24 is a reasonable ceiling — it provides excellent hue coverage
 * (15° average spacing) without becoming unwieldy for semantic token
 * mapping. Systems beyond this tend to have redundant, hard-to-name
 * families. The audit will stop suggesting new colours once this
 * limit is reached.
 */
export const MAX_PALETTE_SIZE = 24;

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

export const TEXT_LEVELS_GREY750: TextLevel[] = [
	{ label: 'Primary',   ...GREY_750_RGB, alpha: 1.00 },
	{ label: 'Secondary', ...GREY_750_RGB, alpha: 0.69 },
	{ label: 'Tertiary',  ...GREY_750_RGB, alpha: 0.62 },
];

export const TEXT_LEVELS_GREY50: TextLevel[] = [
	{ label: 'Primary',   ...GREY_50_RGB, alpha: 1.00 },
	{ label: 'Secondary', ...GREY_50_RGB, alpha: 0.72 },
	{ label: 'Tertiary',  ...GREY_50_RGB, alpha: 0.64 },
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
