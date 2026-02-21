/**
 * Oklch colour math — all functions implemented from the Oklab specification
 * by Björn Ottosson (2020). No external colour libraries.
 */

export interface OklchColor {
	L: number;
	C: number;
	H: number;
}

export interface RgbColor {
	r: number;
	g: number;
	b: number;
}

// ── sRGB ↔ Linear RGB ──────────────────────────────────────────────

export function srgbToLinear(c: number): number {
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function linearToSrgb(c: number): number {
	return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

// ── sRGB → Oklch ────────────────────────────────────────────────────

export function rgbToOklch(r: number, g: number, b: number): OklchColor {
	const rl = srgbToLinear(r);
	const gl = srgbToLinear(g);
	const bl = srgbToLinear(b);

	let l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
	let m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
	let s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;

	const l_ = Math.cbrt(l);
	const m_ = Math.cbrt(m);
	const s_ = Math.cbrt(s);

	const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
	const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
	const bk = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

	const C = Math.sqrt(a ** 2 + bk ** 2);
	const H = ((Math.atan2(bk, a) * 180) / Math.PI + 360) % 360;
	return { L, C, H };
}

// ── Oklch → sRGB (unclamped — may return values outside 0–1) ───────

export function oklchToRgbRaw(L: number, C: number, H: number): RgbColor {
	const hRad = (H * Math.PI) / 180;
	const a = C * Math.cos(hRad);
	const bk = C * Math.sin(hRad);

	const l_ = L + 0.3963377774 * a + 0.2158037573 * bk;
	const m_ = L - 0.1055613458 * a - 0.0638541728 * bk;
	const s_ = L - 0.0894841775 * a - 1.291485548 * bk;

	const l = l_ ** 3;
	const m = m_ ** 3;
	const s = s_ ** 3;

	const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
	const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
	const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

	return { r: linearToSrgb(r), g: linearToSrgb(g), b: linearToSrgb(b) };
}

// ── Oklch → sRGB (clamped to 0–1) ──────────────────────────────────

export function oklchToRgb(L: number, C: number, H: number): RgbColor {
	const { r, g, b } = oklchToRgbRaw(L, C, H);
	return {
		r: Math.max(0, Math.min(1, r)),
		g: Math.max(0, Math.min(1, g)),
		b: Math.max(0, Math.min(1, b))
	};
}

// ── Gamut detection & mapping ───────────────────────────────────────

const GAMUT_EPSILON = 1e-4;

export function isInGamut(rgb: RgbColor): boolean {
	return (
		rgb.r >= -GAMUT_EPSILON &&
		rgb.r <= 1 + GAMUT_EPSILON &&
		rgb.g >= -GAMUT_EPSILON &&
		rgb.g <= 1 + GAMUT_EPSILON &&
		rgb.b >= -GAMUT_EPSILON &&
		rgb.b <= 1 + GAMUT_EPSILON
	);
}

/**
 * Binary search to find the maximum chroma at given L and H that stays
 * within the sRGB gamut. Preserves lightness and hue, only reduces chroma.
 */
export function clampChromaToGamut(L: number, C: number, H: number, epsilon = 0.001): number {
	if (isInGamut(oklchToRgbRaw(L, C, H))) return C;

	let lo = 0;
	let hi = C;
	while (hi - lo > epsilon) {
		const mid = (lo + hi) / 2;
		if (isInGamut(oklchToRgbRaw(L, mid, H))) {
			lo = mid;
		} else {
			hi = mid;
		}
	}
	return lo;
}

/**
 * Compute maximum chroma available at given L and H within sRGB gamut.
 * Used for gamut headroom visualization.
 */
export function maxChromaAtLH(L: number, H: number): number {
	let lo = 0;
	let hi = 0.4;
	while (hi - lo > 0.001) {
		const mid = (lo + hi) / 2;
		if (isInGamut(oklchToRgbRaw(L, mid, H))) {
			lo = mid;
		} else {
			hi = mid;
		}
	}
	return lo;
}

/**
 * Find the Oklch lightness where the sRGB gamut is widest for a given hue.
 * This "cusp" lightness is a fundamental property of the gamut shape and
 * drives adaptive chroma compression: shades near the cusp have excess
 * gamut and need more compression; shades far from it can use more freely.
 */
export function cuspLightness(H: number): number {
	let bestL = 0.5;
	let bestC = 0;
	for (let l10 = 10; l10 < 95; l10++) {
		const l = l10 / 100;
		const c = maxChromaAtLH(l, H);
		if (c > bestC) {
			bestC = c;
			bestL = l;
		}
	}
	return bestL;
}

/**
 * Cusp-aware gamut damping. Modulates the compression factor based on
 * how close the target lightness is to the gamut cusp for this hue:
 *
 *   damping = clamp(base + coeff × |L − cuspL(H)|, 0.1, 1.0)
 *
 * Near the cusp (small distance): damping is lower → more compression,
 * restraining wide-gamut hues that would otherwise look neon.
 *
 * Far from the cusp (large distance): damping approaches 1.0 → less
 * compression, using more of the available (already narrow) gamut.
 *
 * This replaces a flat GAMUT_DAMPING constant with a geometry-derived
 * value that adapts per-hue without any per-hue magic numbers.
 */
export function adaptiveDamping(
	L: number,
	H: number,
	base: number,
	coeff: number,
): number {
	const cuspL = cuspLightness(H);
	const dist = Math.abs(L - cuspL);
	return Math.max(0.1, Math.min(1.0, base + coeff * dist));
}

/**
 * Gamut-width–normalised maximum chroma with cusp-aware adaptive damping.
 *
 * Wide-gamut hues (where maxC exceeds the reference hue's maxC) are
 * compressed toward the reference. The compression strength adapts based
 * on how close the target lightness is to the gamut cusp for this hue.
 *
 * Parameters are passed explicitly to avoid a circular dependency on constants.
 */
export function effectiveMaxChroma(
	L: number,
	H: number,
	referenceHue: number,
	dampingBase: number,
	dampingCoeff: number,
): number {
	const hueMaxC = maxChromaAtLH(L, H);
	const refMaxC = maxChromaAtLH(L, referenceHue);
	if (hueMaxC <= refMaxC) return hueMaxC;
	const damping = adaptiveDamping(L, H, dampingBase, dampingCoeff);
	return refMaxC + (hueMaxC - refMaxC) * damping;
}

// ── Hex utilities ───────────────────────────────────────────────────

export function hexToRgb(hex: string): RgbColor {
	const h = hex.replace('#', '');
	return {
		r: parseInt(h.slice(0, 2), 16) / 255,
		g: parseInt(h.slice(2, 4), 16) / 255,
		b: parseInt(h.slice(4, 6), 16) / 255
	};
}

export function rgbToHex(r: number, g: number, b: number): string {
	const toInt = (c: number) => Math.round(Math.max(0, Math.min(255, c * 255)));
	return (
		'#' +
		[r, g, b]
			.map((c) => toInt(c).toString(16).padStart(2, '0'))
			.join('')
			.toUpperCase()
	);
}

// ── WCAG 2.x Contrast ───────────────────────────────────────────────

export function relativeLuminance(r: number, g: number, b: number): number {
	return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrastRatio(lum1: number, lum2: number): number {
	const lighter = Math.max(lum1, lum2);
	const darker = Math.min(lum1, lum2);
	return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determine the best text colour (white or dark) for a given background,
 * based on which has a higher WCAG contrast ratio.
 */
export function bestTextColor(bgR: number, bgG: number, bgB: number): 'white' | 'dark' {
	const bgLum = relativeLuminance(bgR, bgG, bgB);
	const onWhite = contrastRatio(bgLum, 1.0);
	const onBlack = contrastRatio(bgLum, 0.0);
	return onWhite > onBlack ? 'white' : 'dark';
}

// ── APCA Contrast (Accessible Perceptual Contrast Algorithm) ────────
// Based on APCA-W3 0.0.98G-4g (Silver/WCAG 3 candidate)
// Returns Lc value: positive = dark text on light bg, negative = light text on dark bg
// |Lc| >= 60 is readable body text, |Lc| >= 75 is comfortable, |Lc| >= 90 is excellent

function sRGBtoY(r: number, g: number, b: number): number {
	const mainTRC = 2.4;
	const rLin = Math.pow(Math.max(0, Math.min(1, r)), mainTRC);
	const gLin = Math.pow(Math.max(0, Math.min(1, g)), mainTRC);
	const bLin = Math.pow(Math.max(0, Math.min(1, b)), mainTRC);
	return 0.2126729 * rLin + 0.7151522 * gLin + 0.0721750 * bLin;
}

export function apcaContrast(
	textR: number, textG: number, textB: number,
	bgR: number, bgG: number, bgB: number
): number {
	const Ytxt = sRGBtoY(textR, textG, textB);
	const Ybg = sRGBtoY(bgR, bgG, bgB);

	const normBG = 0.56;
	const normTXT = 0.57;
	const revTXT = 0.62;
	const revBG = 0.65;
	const blkThrs = 0.022;
	const blkClmp = 1.414;
	const scaleBoW = 1.14;
	const scaleWoB = 1.14;
	const loBoWoffset = 0.027;
	const loWoBoffset = 0.027;
	const loClip = 0.1;

	let txtY = (Ytxt > blkThrs) ? Ytxt : Ytxt + Math.pow(blkThrs - Ytxt, blkClmp);
	let bgY = (Ybg > blkThrs) ? Ybg : Ybg + Math.pow(blkThrs - Ybg, blkClmp);

	if (Math.abs(bgY - txtY) < 0.0005) return 0.0;

	let SAPC: number;
	if (bgY > txtY) {
		SAPC = (Math.pow(bgY, normBG) - Math.pow(txtY, normTXT)) * scaleBoW;
		return (SAPC < loClip) ? 0.0 : (SAPC - loBoWoffset) * 100;
	} else {
		SAPC = (Math.pow(bgY, revBG) - Math.pow(txtY, revTXT)) * scaleWoB;
		return (SAPC > -loClip) ? 0.0 : (SAPC + loWoBoffset) * 100;
	}
}

// ── APCA L-target solver ────────────────────────────────────────────

/**
 * Binary-search for the Oklch L where an achromatic fill (C=0) paired with
 * a given text colour hits exactly |Lc| = targetLc under APCA.
 *
 * Using C=0 gives the worst-case (lowest contrast) scenario for any hue,
 * because H-K compensation only makes chromatic fills darker (higher contrast).
 *
 * @param direction
 *   - `'light-fill'`: searches L from 1.0 downward — for light shades with dark text
 *   - `'dark-fill'`:  searches L from 0.0 upward — for dark shades with light text
 * @returns The Oklch L at the APCA |Lc| = targetLc crossing (±0.0001 precision)
 */
export function solveLForApca(
	textR: number, textG: number, textB: number,
	targetLc: number,
	direction: 'light-fill' | 'dark-fill'
): number {
	let lo: number, hi: number;
	if (direction === 'light-fill') {
		lo = 0.3;
		hi = 1.0;
	} else {
		lo = 0.0;
		hi = 0.7;
	}

	for (let i = 0; i < 64; i++) {
		const mid = (lo + hi) / 2;
		const { r, g, b } = oklchToRgb(mid, 0, 0);
		const lc = Math.abs(apcaContrast(textR, textG, textB, r, g, b));

		if (direction === 'light-fill') {
			// Higher L → higher contrast for dark text on light bg.
			// If contrast is too low, move L up; if sufficient, move L down.
			if (lc >= targetLc) hi = mid; else lo = mid;
		} else {
			// Lower L → higher contrast for light text on dark bg.
			// If contrast is too low, move L down; if sufficient, move L up.
			if (lc >= targetLc) lo = mid; else hi = mid;
		}
	}

	return direction === 'light-fill' ? hi : lo;
}

// ── Alpha Compositing ───────────────────────────────────────────────

/**
 * Composite a text colour with alpha over a background colour.
 * Standard "source over" alpha blend: effective = text * a + bg * (1 - a)
 * All values in 0–1 sRGB range.
 */
export function alphaComposite(
	textR: number, textG: number, textB: number, alpha: number,
	bgR: number, bgG: number, bgB: number
): RgbColor {
	return {
		r: textR * alpha + bgR * (1 - alpha),
		g: textG * alpha + bgG * (1 - alpha),
		b: textB * alpha + bgB * (1 - alpha)
	};
}

// ── Hue Geometry ────────────────────────────────────────────────────

/**
 * Angular distance between two hue values (0–360), always positive.
 * Wraps correctly across the 0/360 boundary.
 */
export function hueDelta(h1: number, h2: number): number {
	const d = Math.abs(h1 - h2) % 360;
	return d > 180 ? 360 - d : d;
}

// ── Hex validation ──────────────────────────────────────────────────

export function isValidHex(hex: string): boolean {
	return /^#?[0-9A-Fa-f]{6}$/.test(hex);
}

export function normalizeHex(hex: string): string {
	const h = hex.replace('#', '');
	return '#' + h.toUpperCase();
}
