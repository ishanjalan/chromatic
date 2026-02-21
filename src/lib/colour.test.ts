import { describe, it, expect } from 'vitest';
import {
	srgbToLinear,
	linearToSrgb,
	rgbToOklch,
	oklchToRgb,
	oklchToRgbRaw,
	hexToRgb,
	rgbToHex,
	isInGamut,
	clampChromaToGamut,
	relativeLuminance,
	contrastRatio,
	bestTextColor,
	apcaContrast,
	solveLForApca,
	alphaComposite,
	isValidHex,
	normalizeHex
} from './colour';

// ── sRGB ↔ Linear RGB round-trips ──────────────────────────────────

describe('sRGB ↔ Linear RGB', () => {
	it('round-trips 0', () => {
		expect(linearToSrgb(srgbToLinear(0))).toBeCloseTo(0, 10);
	});

	it('round-trips 1', () => {
		expect(linearToSrgb(srgbToLinear(1))).toBeCloseTo(1, 10);
	});

	it('round-trips midtones', () => {
		for (const val of [0.1, 0.25, 0.5, 0.75, 0.9]) {
			expect(linearToSrgb(srgbToLinear(val))).toBeCloseTo(val, 6);
		}
	});

	it('srgbToLinear handles the 0.04045 threshold boundary', () => {
		const below = srgbToLinear(0.04);
		const above = srgbToLinear(0.05);
		expect(below).toBeLessThan(above);
		expect(below).toBeCloseTo(0.04 / 12.92, 10);
	});

	it('linearToSrgb handles the 0.0031308 threshold boundary', () => {
		const below = linearToSrgb(0.003);
		const above = linearToSrgb(0.004);
		expect(below).toBeLessThan(above);
		expect(below).toBeCloseTo(0.003 * 12.92, 10);
	});
});

// ── Oklch round-trip fidelity ────────────────────────────────────────

describe('rgbToOklch / oklchToRgb round-trip', () => {
	const testColors: [number, number, number, string][] = [
		[1, 0, 0, 'red'],
		[0, 1, 0, 'green'],
		[0, 0, 1, 'blue'],
		[1, 1, 1, 'white'],
		[0, 0, 0, 'black'],
		[0.5, 0.5, 0.5, 'mid-grey'],
		[0.494, 0.259, 0.922, 'purple (#7E42EB)']
	];

	for (const [r, g, b, label] of testColors) {
		it(`round-trips ${label}`, () => {
			const oklch = rgbToOklch(r, g, b);
			const rgb = oklchToRgb(oklch.L, oklch.C, oklch.H);
			expect(rgb.r).toBeCloseTo(r, 2);
			expect(rgb.g).toBeCloseTo(g, 2);
			expect(rgb.b).toBeCloseTo(b, 2);
		});
	}

	it('Oklch L is 0 for black', () => {
		const { L } = rgbToOklch(0, 0, 0);
		expect(L).toBeCloseTo(0, 4);
	});

	it('Oklch L is 1 for white', () => {
		const { L } = rgbToOklch(1, 1, 1);
		expect(L).toBeCloseTo(1, 4);
	});

	it('Oklch C is 0 for achromatic colours', () => {
		const { C } = rgbToOklch(0.5, 0.5, 0.5);
		expect(C).toBeCloseTo(0, 3);
	});
});

// ── Hex utilities ───────────────────────────────────────────────────

describe('hexToRgb', () => {
	it('parses #000000', () => {
		const { r, g, b } = hexToRgb('#000000');
		expect(r).toBe(0);
		expect(g).toBe(0);
		expect(b).toBe(0);
	});

	it('parses #FFFFFF', () => {
		const { r, g, b } = hexToRgb('#FFFFFF');
		expect(r).toBe(1);
		expect(g).toBe(1);
		expect(b).toBe(1);
	});

	it('parses #7E42EB', () => {
		const { r, g, b } = hexToRgb('#7E42EB');
		expect(r).toBeCloseTo(126 / 255, 4);
		expect(g).toBeCloseTo(66 / 255, 4);
		expect(b).toBeCloseTo(235 / 255, 4);
	});

	it('works without hash prefix', () => {
		const { r, g, b } = hexToRgb('FF0000');
		expect(r).toBe(1);
		expect(g).toBe(0);
		expect(b).toBe(0);
	});
});

describe('rgbToHex', () => {
	it('converts black', () => {
		expect(rgbToHex(0, 0, 0)).toBe('#000000');
	});

	it('converts white', () => {
		expect(rgbToHex(1, 1, 1)).toBe('#FFFFFF');
	});

	it('converts red', () => {
		expect(rgbToHex(1, 0, 0)).toBe('#FF0000');
	});

	it('clamps out-of-range values', () => {
		const hex = rgbToHex(1.5, -0.1, 0.5);
		expect(hex).toBe('#FF0080');
	});

	it('returns uppercase hex', () => {
		const hex = rgbToHex(0.5, 0.5, 0.5);
		expect(hex).toBe(hex.toUpperCase());
	});
});

// ── Hex validation ─────────────────────────────────────────────────

describe('isValidHex', () => {
	it('accepts 6-char hex with hash', () => {
		expect(isValidHex('#7E42EB')).toBe(true);
	});

	it('accepts 6-char hex without hash', () => {
		expect(isValidHex('7E42EB')).toBe(true);
	});

	it('accepts lowercase', () => {
		expect(isValidHex('#aabbcc')).toBe(true);
	});

	it('rejects short hex', () => {
		expect(isValidHex('#FFF')).toBe(false);
	});

	it('rejects empty string', () => {
		expect(isValidHex('')).toBe(false);
	});

	it('rejects 8-char hex', () => {
		expect(isValidHex('#AABBCCDD')).toBe(false);
	});

	it('rejects non-hex characters', () => {
		expect(isValidHex('#GGHHII')).toBe(false);
	});
});

describe('normalizeHex', () => {
	it('adds hash prefix', () => {
		expect(normalizeHex('aabbcc')).toBe('#AABBCC');
	});

	it('uppercases', () => {
		expect(normalizeHex('#aabbcc')).toBe('#AABBCC');
	});

	it('does not duplicate hash', () => {
		expect(normalizeHex('#AABBCC')).toBe('#AABBCC');
	});
});

// ── WCAG 2.x Contrast ──────────────────────────────────────────────

describe('relativeLuminance', () => {
	it('returns 0 for black', () => {
		expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0, 6);
	});

	it('returns 1 for white', () => {
		expect(relativeLuminance(1, 1, 1)).toBeCloseTo(1, 4);
	});

	it('returns ~0.2126 for pure red', () => {
		expect(relativeLuminance(1, 0, 0)).toBeCloseTo(0.2126, 3);
	});
});

describe('contrastRatio', () => {
	it('returns 21:1 for white on black', () => {
		expect(contrastRatio(1, 0)).toBeCloseTo(21, 0);
	});

	it('returns 1:1 for same luminance', () => {
		expect(contrastRatio(0.5, 0.5)).toBeCloseTo(1, 4);
	});

	it('is order-independent', () => {
		expect(contrastRatio(0.8, 0.2)).toBeCloseTo(contrastRatio(0.2, 0.8), 6);
	});
});

describe('bestTextColor', () => {
	it('returns white for dark backgrounds', () => {
		expect(bestTextColor(0, 0, 0)).toBe('white');
		expect(bestTextColor(0.1, 0.1, 0.1)).toBe('white');
	});

	it('returns dark for light backgrounds', () => {
		expect(bestTextColor(1, 1, 1)).toBe('dark');
		expect(bestTextColor(0.9, 0.9, 0.9)).toBe('dark');
	});
});

// ── APCA Contrast ───────────────────────────────────────────────────

describe('apcaContrast', () => {
	it('returns a large positive Lc for black text on white background', () => {
		const lc = apcaContrast(0, 0, 0, 1, 1, 1);
		expect(lc).toBeGreaterThan(100);
	});

	it('returns a large negative Lc for white text on black background', () => {
		const lc = apcaContrast(1, 1, 1, 0, 0, 0);
		expect(lc).toBeLessThan(-100);
	});

	it('returns 0 for identical colours', () => {
		const lc = apcaContrast(0.5, 0.5, 0.5, 0.5, 0.5, 0.5);
		expect(lc).toBeCloseTo(0, 0);
	});

	it('returns positive Lc when text is darker than background', () => {
		const lc = apcaContrast(0.2, 0.2, 0.2, 0.8, 0.8, 0.8);
		expect(lc).toBeGreaterThan(0);
	});

	it('returns negative Lc when text is lighter than background', () => {
		const lc = apcaContrast(0.9, 0.9, 0.9, 0.1, 0.1, 0.1);
		expect(lc).toBeLessThan(0);
	});
});

// ── APCA L-target solver ────────────────────────────────────────────

describe('solveLForApca', () => {
	const GREY_750 = { r: 0.1137, g: 0.1137, b: 0.1137 };
	const GREY_50 = { r: 1.0, g: 1.0, b: 1.0 };

	it('finds the Lc 75 crossing for dark text on light fill', () => {
		const L = solveLForApca(GREY_750.r, GREY_750.g, GREY_750.b, 75, 'light-fill');
		expect(L).toBeGreaterThan(0.7);
		expect(L).toBeLessThan(1.0);
		// Verify it actually achieves Lc 75 at the solved L
		const { r, g, b } = oklchToRgb(L, 0, 0);
		const lc = Math.abs(apcaContrast(GREY_750.r, GREY_750.g, GREY_750.b, r, g, b));
		expect(lc).toBeCloseTo(75, 0);
	});

	it('finds the Lc 75 crossing for light text on dark fill', () => {
		const L = solveLForApca(GREY_50.r, GREY_50.g, GREY_50.b, 75, 'dark-fill');
		expect(L).toBeGreaterThan(0.3);
		expect(L).toBeLessThan(0.7);
		const { r, g, b } = oklchToRgb(L, 0, 0);
		const lc = Math.abs(apcaContrast(GREY_50.r, GREY_50.g, GREY_50.b, r, g, b));
		expect(lc).toBeCloseTo(75, 0);
	});

	it('higher targetLc requires lighter fill for dark text', () => {
		const L75 = solveLForApca(GREY_750.r, GREY_750.g, GREY_750.b, 75, 'light-fill');
		const L90 = solveLForApca(GREY_750.r, GREY_750.g, GREY_750.b, 90, 'light-fill');
		expect(L90).toBeGreaterThan(L75);
	});

	it('higher targetLc requires darker fill for light text', () => {
		const L75 = solveLForApca(GREY_50.r, GREY_50.g, GREY_50.b, 75, 'dark-fill');
		const L90 = solveLForApca(GREY_50.r, GREY_50.g, GREY_50.b, 90, 'dark-fill');
		expect(L90).toBeLessThan(L75);
	});

	it('has sub-0.001 precision', () => {
		const L = solveLForApca(GREY_750.r, GREY_750.g, GREY_750.b, 75, 'light-fill');
		const { r, g, b } = oklchToRgb(L, 0, 0);
		const lc = Math.abs(apcaContrast(GREY_750.r, GREY_750.g, GREY_750.b, r, g, b));
		expect(Math.abs(lc - 75)).toBeLessThan(0.5);
	});
});

// ── Gamut Detection & Clamping ──────────────────────────────────────

describe('isInGamut', () => {
	it('pure sRGB colours are in gamut', () => {
		expect(isInGamut({ r: 0, g: 0, b: 0 })).toBe(true);
		expect(isInGamut({ r: 1, g: 1, b: 1 })).toBe(true);
		expect(isInGamut({ r: 0.5, g: 0.3, b: 0.8 })).toBe(true);
	});

	it('out-of-range values are out of gamut', () => {
		expect(isInGamut({ r: -0.1, g: 0, b: 0 })).toBe(false);
		expect(isInGamut({ r: 0, g: 1.1, b: 0 })).toBe(false);
	});
});

describe('clampChromaToGamut', () => {
	it('returns original chroma when already in gamut', () => {
		const oklch = rgbToOklch(0.5, 0.3, 0.8);
		const clamped = clampChromaToGamut(oklch.L, oklch.C, oklch.H);
		expect(clamped).toBeCloseTo(oklch.C, 2);
	});

	it('reduces chroma for out-of-gamut colours', () => {
		const highC = clampChromaToGamut(0.5, 0.4, 120);
		expect(highC).toBeLessThan(0.4);
		expect(highC).toBeGreaterThan(0);
	});

	it('resulting colour is within sRGB gamut', () => {
		const L = 0.7;
		const H = 150;
		const C = clampChromaToGamut(L, 0.35, H);
		const raw = oklchToRgbRaw(L, C, H);
		expect(isInGamut(raw)).toBe(true);
	});
});

// ── Alpha Compositing ───────────────────────────────────────────────

describe('alphaComposite', () => {
	it('fully opaque text returns text colour', () => {
		const result = alphaComposite(1, 0, 0, 1, 0, 0, 0);
		expect(result.r).toBeCloseTo(1, 6);
		expect(result.g).toBeCloseTo(0, 6);
		expect(result.b).toBeCloseTo(0, 6);
	});

	it('fully transparent text returns background colour', () => {
		const result = alphaComposite(1, 0, 0, 0, 0, 0, 1);
		expect(result.r).toBeCloseTo(0, 6);
		expect(result.g).toBeCloseTo(0, 6);
		expect(result.b).toBeCloseTo(1, 6);
	});

	it('50% alpha blends halfway', () => {
		const result = alphaComposite(1, 1, 1, 0.5, 0, 0, 0);
		expect(result.r).toBeCloseTo(0.5, 6);
		expect(result.g).toBeCloseTo(0.5, 6);
		expect(result.b).toBeCloseTo(0.5, 6);
	});

	it('composites Grey/750 at 69% over white correctly', () => {
		const grey750 = 0.1137;
		const result = alphaComposite(grey750, grey750, grey750, 0.69, 1, 1, 1);
		const expected = grey750 * 0.69 + 1 * 0.31;
		expect(result.r).toBeCloseTo(expected, 4);
	});
});
