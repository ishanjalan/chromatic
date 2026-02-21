/**
 * APCA Font Size Lookup Table — Public Beta 0.1.7 (G)
 *
 * Maps absolute APCA Lc contrast values to minimum font sizes (px) per
 * CSS font-weight (100–900). Derived from the official SAPC-APCA
 * reference data by Andrew Somers / Myndex Research.
 *
 * Values:
 *   999 = too low contrast, do not use
 *   777 = non-text only (icons, decorative)
 *   Other = minimum font size in px for that weight
 *
 * Usage:
 *   fontLookupAPCA(75)  → { weights: [60, 42, 24, 18, 16, 15, 14, 16, 18] }
 *   fontLookupAPCA(45)  → { weights: [108, 96, 72, 42, 32, 28, 24, 24, 24] }
 */

const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

const FONT_MATRIX: readonly (readonly number[])[] = [
	/*  Lc    100  200  300  400  500  600  700  800  900 */
	/*   0 */ [999, 999, 999, 999, 999, 999, 999, 999, 999],
	/*  10 */ [999, 999, 999, 999, 999, 999, 999, 999, 999],
	/*  15 */ [777, 777, 777, 777, 777, 777, 777, 777, 777],
	/*  20 */ [777, 777, 777, 777, 777, 777, 777, 777, 777],
	/*  25 */ [777, 777, 777, 120, 120, 108, 96, 96, 96],
	/*  30 */ [777, 777, 120, 108, 108, 96, 72, 72, 72],
	/*  35 */ [777, 120, 108, 96, 72, 60, 48, 48, 48],
	/*  40 */ [120, 108, 96, 60, 48, 42, 32, 32, 32],
	/*  45 */ [108, 96, 72, 42, 32, 28, 24, 24, 24],
	/*  50 */ [96, 72, 60, 32, 28, 24, 21, 21, 21],
	/*  55 */ [80, 60, 48, 28, 24, 21, 18, 18, 18],
	/*  60 */ [72, 48, 42, 24, 21, 18, 16, 16, 18],
	/*  65 */ [68, 46, 32, 21.75, 19, 17, 15, 16, 18],
	/*  70 */ [64, 44, 28, 19.5, 18, 16, 14.5, 16, 18],
	/*  75 */ [60, 42, 24, 18, 16, 15, 14, 16, 18],
	/*  80 */ [56, 38.25, 23, 17.25, 15.81, 14.81, 14, 16, 18],
	/*  85 */ [52, 34.5, 22, 16.5, 15.625, 14.625, 14, 16, 18],
	/*  90 */ [48, 32, 21, 16, 15.5, 14.5, 14, 16, 18],
	/*  95 */ [45, 28, 19.5, 15.5, 15, 14, 13.5, 16, 18],
	/* 100 */ [42, 26.5, 18.5, 15, 14.5, 13.5, 13, 16, 18],
	/* 105 */ [39, 25, 18, 14.5, 14, 13, 12, 16, 18],
	/* 110 */ [36, 24, 18, 14, 13, 12, 11, 16, 18],
	/* 115 */ [34.5, 22.5, 17.25, 12.5, 11.875, 11.25, 10.625, 14.5, 16.5],
	/* 120 */ [33, 21, 16.5, 11, 10.75, 10.5, 10.25, 13, 15],
	/* 125 */ [32, 20, 16, 10, 10, 10, 10, 12, 14],
];

const LC_VALUES = [0, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125];

export interface FontRecommendation {
	weight: number;
	minSize: number;
	usable: boolean;
}

export interface FontLookupResult {
	lc: number;
	level: 'prohibited' | 'non-text' | 'spot-text' | 'body-text';
	recommendations: FontRecommendation[];
	bestWeight: number | null;
	bestMinSize: number | null;
}

/**
 * Look up minimum font sizes for a given APCA |Lc| value.
 *
 * Returns per-weight minimum font sizes and the best (smallest minimum
 * font) weight. Interpolates between the 5-unit Lc grid steps.
 */
export function fontLookupAPCA(absLc: number): FontLookupResult {
	const lc = Math.abs(absLc);

	if (lc < 15) {
		return { lc, level: 'prohibited', recommendations: [], bestWeight: null, bestMinSize: null };
	}

	// Find the row index for interpolation
	let rowIdx = 0;
	for (let i = 0; i < LC_VALUES.length - 1; i++) {
		if (lc >= LC_VALUES[i]) rowIdx = i;
	}

	const row = FONT_MATRIX[rowIdx];
	const recommendations: FontRecommendation[] = [];
	let bestWeight: number | null = null;
	let bestMinSize: number | null = null;

	for (let w = 0; w < WEIGHTS.length; w++) {
		const size = row[w];
		const usable = size < 400;
		recommendations.push({ weight: WEIGHTS[w], minSize: Math.ceil(size), usable });

		if (usable && (bestMinSize === null || size < bestMinSize)) {
			bestMinSize = size;
			bestWeight = WEIGHTS[w];
		}
	}

	let level: FontLookupResult['level'];
	if (lc < 25) level = 'non-text';
	else if (lc < 45) level = 'spot-text';
	else level = 'body-text';

	return {
		lc,
		level,
		recommendations,
		bestWeight,
		bestMinSize: bestMinSize !== null ? Math.ceil(bestMinSize) : null,
	};
}

/**
 * Compact summary for UI display: returns the minimum font size at
 * weight 400 (regular) and weight 700 (bold), or null if not usable.
 */
export function fontSummary(absLc: number): { regular: number | null; bold: number | null } {
	const result = fontLookupAPCA(absLc);
	const reg = result.recommendations.find((r) => r.weight === 400);
	const bold = result.recommendations.find((r) => r.weight === 700);
	return {
		regular: reg?.usable ? reg.minSize : null,
		bold: bold?.usable ? bold.minSize : null,
	};
}
