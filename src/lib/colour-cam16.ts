/**
 * Minimal CAM16 hue model — CIE 224:2017.
 *
 * Provides the forward CAM16 hue angle for an Oklch colour, and a
 * binary-search helper that finds the Oklch hue which preserves the
 * same CAM16 perceptual hue at a different lightness. This compensates
 * for the Abney effect without any per-hue magic numbers.
 */

import { srgbToLinear, oklchToRgb } from './colour';

// ── Viewing conditions (typical sRGB display) ───────────────────────
//   D65 white, L_A = 64 cd/m², Y_b = 20 %, average surround

const M16 = [
	[0.401288, 0.650173, -0.051461],
	[-0.250268, 1.204414, 0.045854],
	[-0.002079, 0.048952, 0.953127],
] as const;

const XYZ_D65 = [95.047, 100.0, 108.883] as const;

function dot3(row: readonly number[], v: [number, number, number]): number {
	return row[0] * v[0] + row[1] * v[1] + row[2] * v[2];
}

function adaptedResponse(component: number, fl: number): number {
	const p = Math.pow(fl * Math.abs(component) / 100.0, 0.42);
	return 400.0 * Math.sign(component) * p / (p + 27.13);
}

const LA = 64;
const YB = 20;
const F = 1.0;
const NC = 1.0;

const k = 1.0 / (5.0 * LA + 1.0);
const k4 = k * k * k * k;
const FL = k4 * LA + 0.1 * (1.0 - k4) * (1.0 - k4) * Math.cbrt(5.0 * LA);

const n = YB / 100.0;
const z = 1.48 + Math.sqrt(n);
const nbb = 0.725 * Math.pow(1.0 / n, 0.2);

const D = F * (1.0 - (1.0 / 3.6) * Math.exp((-LA - 42.0) / 92.0));

const rgbW: [number, number, number] = [
	dot3(M16[0], XYZ_D65 as unknown as [number, number, number]),
	dot3(M16[1], XYZ_D65 as unknown as [number, number, number]),
	dot3(M16[2], XYZ_D65 as unknown as [number, number, number]),
];

const dRgb: [number, number, number] = [
	D * (100.0 / rgbW[0]) + 1.0 - D,
	D * (100.0 / rgbW[1]) + 1.0 - D,
	D * (100.0 / rgbW[2]) + 1.0 - D,
];

const rgbAW: [number, number, number] = [
	adaptedResponse(rgbW[0] * dRgb[0], FL),
	adaptedResponse(rgbW[1] * dRgb[1], FL),
	adaptedResponse(rgbW[2] * dRgb[2], FL),
];

const AW = (2.0 * rgbAW[0] + rgbAW[1] + 0.05 * rgbAW[2] - 0.305) * nbb;

// ── Linear sRGB → XYZ (D65, scaled 0-100) ──────────────────────────

const SRGB_TO_XYZ = [
	[0.4124564, 0.3575761, 0.1804375],
	[0.2126729, 0.7151522, 0.0721750],
	[0.0193339, 0.1191920, 0.9503041],
] as const;

function linearRgbToXyz100(rLin: number, gLin: number, bLin: number): [number, number, number] {
	return [
		100 * (SRGB_TO_XYZ[0][0] * rLin + SRGB_TO_XYZ[0][1] * gLin + SRGB_TO_XYZ[0][2] * bLin),
		100 * (SRGB_TO_XYZ[1][0] * rLin + SRGB_TO_XYZ[1][1] * gLin + SRGB_TO_XYZ[1][2] * bLin),
		100 * (SRGB_TO_XYZ[2][0] * rLin + SRGB_TO_XYZ[2][1] * gLin + SRGB_TO_XYZ[2][2] * bLin),
	];
}

// ── CAM16 forward: XYZ → hue angle ─────────────────────────────────

function cam16HueFromXyz(X: number, Y: number, Z: number): number {
	const rgb: [number, number, number] = [
		dot3(M16[0], [X, Y, Z]),
		dot3(M16[1], [X, Y, Z]),
		dot3(M16[2], [X, Y, Z]),
	];

	const rgbC: [number, number, number] = [
		rgb[0] * dRgb[0],
		rgb[1] * dRgb[1],
		rgb[2] * dRgb[2],
	];

	const rgbA: [number, number, number] = [
		adaptedResponse(rgbC[0], FL),
		adaptedResponse(rgbC[1], FL),
		adaptedResponse(rgbC[2], FL),
	];

	const a = rgbA[0] - 12.0 * rgbA[1] / 11.0 + rgbA[2] / 11.0;
	const b = (rgbA[0] + rgbA[1] - 2.0 * rgbA[2]) / 9.0;

	return ((Math.atan2(b, a) * 180.0) / Math.PI + 360.0) % 360.0;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Compute the CAM16 hue angle for an Oklch colour.
 * Converts Oklch → sRGB → linear RGB → XYZ → CAM16 h.
 */
export function cam16Hue(L: number, C: number, H: number): number {
	const { r, g, b } = oklchToRgb(L, C, H);
	const rLin = srgbToLinear(r);
	const gLin = srgbToLinear(g);
	const bLin = srgbToLinear(b);
	const [X, Y, Z] = linearRgbToXyz100(rLin, gLin, bLin);
	return cam16HueFromXyz(X, Y, Z);
}

/**
 * Find the Oklch hue at (targetL, targetC) that gives the same CAM16
 * perceptual hue as the anchor at (anchorL, anchorC, anchorH).
 *
 * Returns the corrected Oklch hue angle (0–360).
 * For achromatic or near-achromatic colours, returns anchorH unchanged.
 */
const MAX_HUE_DRIFT = 15; // degrees — perceptual limit before hue identity is lost

export function correctedHue(
	anchorH: number,
	anchorL: number,
	anchorC: number,
	targetL: number,
	targetC: number,
): number {
	if (anchorC < 0.005 || targetC < 0.005) return anchorH;

	const targetCam16H = cam16Hue(anchorL, anchorC, anchorH);

	let lo = anchorH - 60;
	let hi = anchorH + 60;

	for (let i = 0; i < 48; i++) {
		const mid = (lo + hi) / 2;
		const midNorm = ((mid % 360) + 360) % 360;
		const h = cam16Hue(targetL, targetC, midNorm);

		let delta = h - targetCam16H;
		if (delta > 180) delta -= 360;
		if (delta < -180) delta += 360;

		if (delta > 0) {
			hi = mid;
		} else {
			lo = mid;
		}
	}

	const result = (((lo + hi) / 2 % 360) + 360) % 360;

	// Clamp: if the sRGB gamut forced the Oklch hue too far from the
	// anchor (common for blue/indigo at very light shades), cap the
	// drift so the shade still reads as the same hue family.
	let drift = result - anchorH;
	if (drift > 180) drift -= 360;
	if (drift < -180) drift += 360;

	if (Math.abs(drift) > MAX_HUE_DRIFT) {
		const clamped = anchorH + Math.sign(drift) * MAX_HUE_DRIFT;
		return ((clamped % 360) + 360) % 360;
	}

	return result;
}

