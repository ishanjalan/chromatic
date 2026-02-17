/**
 * Colour Vision Deficiency (CVD) simulation using Vienot 1999 matrices.
 *
 * Simulates how colours appear to people with:
 * - Protanopia (no L-cones, ~1% of males)
 * - Deuteranopia (no M-cones, ~1% of males)
 * - Tritanopia (no S-cones, ~0.003%)
 *
 * Algorithm: sRGB → linear RGB → 3x3 matrix transform → sRGB
 * These are the same matrices used by Chrome DevTools.
 */

import { srgbToLinear, linearToSrgb, hexToRgb, rgbToHex } from './colour';
import type { RgbColor } from './colour';

export type CVDType = 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export const CVD_LABELS: Record<CVDType, string> = {
	normal: 'Normal Vision',
	protanopia: 'Protanopia',
	deuteranopia: 'Deuteranopia',
	tritanopia: 'Tritanopia'
};

export const CVD_DESCRIPTIONS: Record<CVDType, string> = {
	normal: 'Trichromatic — all three cone types present',
	protanopia: 'L-cone absent — reduced red sensitivity, affects ~1% of males',
	deuteranopia: 'M-cone absent — most common CVD, affects ~1% of males',
	tritanopia: 'S-cone absent — very rare (~0.003%), affects blue-yellow discrimination'
};

type Matrix3x3 = [
	[number, number, number],
	[number, number, number],
	[number, number, number]
];

const PROTAN_MATRIX: Matrix3x3 = [
	[0.152286, 1.052583, -0.204868],
	[0.114503, 0.786281, 0.099216],
	[-0.003882, -0.048116, 1.051998]
];

const DEUTAN_MATRIX: Matrix3x3 = [
	[0.367322, 0.860646, -0.227968],
	[0.280085, 0.672501, 0.047413],
	[-0.011820, 0.042940, 0.968881]
];

const TRITAN_MATRIX: Matrix3x3 = [
	[1.255528, -0.076749, -0.178779],
	[-0.078411, 0.930809, 0.147602],
	[0.004733, 0.691367, 0.303900]
];

const MATRICES: Record<Exclude<CVDType, 'normal'>, Matrix3x3> = {
	protanopia: PROTAN_MATRIX,
	deuteranopia: DEUTAN_MATRIX,
	tritanopia: TRITAN_MATRIX
};

function applyMatrix(m: Matrix3x3, r: number, g: number, b: number): [number, number, number] {
	return [
		m[0][0] * r + m[0][1] * g + m[0][2] * b,
		m[1][0] * r + m[1][1] * g + m[1][2] * b,
		m[2][0] * r + m[2][1] * g + m[2][2] * b
	];
}

/**
 * Simulate how a colour appears under a specific CVD type.
 * Input: sRGB values in 0-1 range.
 * Returns: simulated sRGB values in 0-1 range.
 */
export function simulateCVD(r: number, g: number, b: number, type: CVDType): RgbColor {
	if (type === 'normal') return { r, g, b };

	const linR = srgbToLinear(r);
	const linG = srgbToLinear(g);
	const linB = srgbToLinear(b);

	const matrix = MATRICES[type];
	const [simR, simG, simB] = applyMatrix(matrix, linR, linG, linB);

	return {
		r: Math.max(0, Math.min(1, linearToSrgb(simR))),
		g: Math.max(0, Math.min(1, linearToSrgb(simG))),
		b: Math.max(0, Math.min(1, linearToSrgb(simB)))
	};
}

/**
 * Simulate a hex colour under a specific CVD type.
 * Returns a new hex string.
 */
export function simulateHex(hex: string, type: CVDType): string {
	if (type === 'normal') return hex;
	const { r, g, b } = hexToRgb(hex);
	const sim = simulateCVD(r, g, b, type);
	return rgbToHex(sim.r, sim.g, sim.b);
}
