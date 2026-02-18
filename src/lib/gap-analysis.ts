/**
 * Hue-gap analysis v2 — multi-signal suggestion engine.
 *
 * Improvements over v1 (pure hue-gap):
 * 1. **Chroma compatibility** — candidates are scored by how well their
 *    natural chroma at the suggested hue matches the palette's median
 *    relative chroma. This ensures suggestions "harmonise" in perceived
 *    saturation strength, not just fill angular gaps.
 * 2. **Warm / cool balance** — when one hemisphere is over-represented,
 *    candidates on the opposite side get a boost.
 * 3. **Dynamic gap threshold** — the minimum gap for a suggestion shrinks
 *    as the palette grows (larger palettes naturally have smaller gaps).
 * 4. **Palette size cap** — stops suggesting when the palette reaches
 *    MAX_PALETTE_SIZE (24).
 * 5. **Coverage uniformity** — the overall score considers variance of
 *    gap sizes, not just the largest individual gap.
 *
 * Suggestion preview hexes remain generated at TARGET_CURVE[300] lightness
 * and chroma, gamut-clamped, so previews match generator output.
 */

import { oklchToRgb, rgbToHex, clampChromaToGamut, maxChromaAtLH, hueDelta } from './colour';
import { TARGET_CURVE, MAX_PALETTE_SIZE, ANCHOR_REF_CHROMA } from './constants';
import { TAILWIND_COLORS } from './tailwind-match';
import { SPECTRUM_COLORS } from './spectrum-colors';
import { RADIX_COLORS } from './radix-colors';
import type { HueDot } from './components/HueWheel.svelte';

// ── Exported interfaces ─────────────────────────────────────────────

export interface GapSuggestion {
	/** Suggested colour name */
	name: string;
	/** Source palette */
	source: 'Tailwind' | 'Spectrum' | 'Radix';
	/** Representative hex for display */
	hex: string;
	/** Oklch hue angle of the suggestion */
	hue: number;
	/** The gap this suggestion fills (degrees) */
	gapSize: number;
	/** Names of the two adjacent families that form the gap */
	between: [string, string];
	/** Composite score (higher is better) — used for ranking */
	score: number;
	/** Hue centrality sub-score (0-1): how well this centres the gap */
	hueScore: number;
	/** Chroma compatibility sub-score (0-1): match with palette median chroma */
	chromaScore: number;
	/** Balance correction sub-score (0-1): corrects warm/cool imbalance */
	balanceScore: number;
	/** Short rationale explaining why this suggestion is good */
	rationale: string;
}

export interface CoverageStats {
	/** Number of remaining slots before MAX_PALETTE_SIZE */
	remainingSlots: number;
	/** Ideal uniform gap for the current palette size (360 / n) */
	idealGap: number;
	/** Actual mean gap */
	meanGap: number;
	/** Gap standard deviation — lower is better */
	gapStdDev: number;
	/** Warm hue count (0-60° and 300-360°) */
	warmCount: number;
	/** Cool hue count (120-270°) */
	coolCount: number;
	/** Neutral zone count (60-120° and 270-300°) */
	neutralCount: number;
	/** Whether the palette is warm-heavy, cool-heavy, or balanced */
	balance: 'balanced' | 'warm-heavy' | 'cool-heavy';
}

// ── Internal types ──────────────────────────────────────────────────

interface HueEntry {
	name: string;
	hue: number;
}

interface ScoredCandidate {
	name: string;
	hue: number;
	hex: string;
	source: 'Tailwind' | 'Spectrum' | 'Radix';
	hueScore: number;
	chromaScore: number;
	balanceScore: number;
	compositeScore: number;
	rationale: string;
}

// ── Geometric helpers ───────────────────────────────────────────────

function clockwiseDistance(a: number, b: number): number {
	return ((b - a) % 360 + 360) % 360;
}

function midpointHue(a: number, b: number): number {
	const dist = clockwiseDistance(a, b);
	return (a + dist / 2) % 360;
}

function isInArc(hue: number, start: number, end: number): boolean {
	const distToEnd = clockwiseDistance(start, end);
	const distToHue = clockwiseDistance(start, hue);
	return distToHue < distToEnd;
}

// ── Hue hemisphere classification ───────────────────────────────────

type HueZone = 'warm' | 'cool' | 'neutral';

function classifyHue(hue: number): HueZone {
	const h = ((hue % 360) + 360) % 360;
	if ((h >= 0 && h < 60) || h >= 300) return 'warm';
	if (h >= 120 && h < 270) return 'cool';
	return 'neutral'; // 60-120 (yellow-green) and 270-300 (blue-violet)
}

// ── Dynamic gap threshold ───────────────────────────────────────────

/**
 * Compute the minimum gap threshold based on current palette size.
 *
 * Logic: ideal uniform spacing is 360/n. We trigger suggestions when a
 * gap exceeds 1.5× the ideal spacing, with a floor of 15° and ceiling
 * of 40°. This means:
 *   - 8 families  → ideal 45°, threshold 40° (capped)
 *   - 12 families → ideal 30°, threshold 40° (capped)
 *   - 16 families → ideal 22.5°, threshold 33.75°
 *   - 20 families → ideal 18°, threshold 27°
 *   - 24 families → ideal 15°, threshold 22.5°
 */
function dynamicGapThreshold(familyCount: number): number {
	if (familyCount <= 1) return 40;
	const ideal = 360 / familyCount;
	const threshold = ideal * 1.5;
	return Math.max(15, Math.min(40, threshold));
}

// ── Chroma compatibility ────────────────────────────────────────────

/**
 * Compute the relative chroma a candidate would have at a given hue.
 * Returns a value in [0, 1] representing what fraction of the gamut
 * maximum the standard TARGET_CURVE[300] chroma achieves at this hue.
 */
function candidateRelativeChroma(hue: number): number {
	const { L } = TARGET_CURVE[300];
	const maxC = maxChromaAtLH(L, hue);
	if (maxC <= 0) return 0;
	const clampedC = clampChromaToGamut(L, ANCHOR_REF_CHROMA, hue);
	return clampedC / maxC;
}

// ── Reference palette builder ───────────────────────────────────────

function buildReferenceColors(existingHues: number[]): Array<{
	name: string;
	hue: number;
	hex: string;
	source: 'Tailwind' | 'Spectrum' | 'Radix';
	relativeChroma: number;
}> {
	const OVERLAP_TOLERANCE = 10;

	type RefEntry = { name: string; hue: number; hex: string; source: 'Tailwind' | 'Spectrum' | 'Radix'; relativeChroma: number };
	const refs: RefEntry[] = [];

	for (const tw of TAILWIND_COLORS) {
		const tooClose = existingHues.some((h) => hueDelta(h, tw.hue) < OVERLAP_TOLERANCE);
		if (!tooClose) {
			refs.push({
				name: tw.name,
				hue: tw.hue,
				hex: previewHexForHue(tw.hue),
				source: 'Tailwind',
				relativeChroma: candidateRelativeChroma(tw.hue)
			});
		}
	}

	for (const sp of SPECTRUM_COLORS) {
		const tooClose = existingHues.some((h) => hueDelta(h, sp.hue) < OVERLAP_TOLERANCE);
		if (!tooClose) {
			refs.push({
				name: sp.name,
				hue: sp.hue,
				hex: previewHexForHue(sp.hue),
				source: 'Spectrum',
				relativeChroma: candidateRelativeChroma(sp.hue)
			});
		}
	}

	for (const rx of RADIX_COLORS) {
		const tooClose = existingHues.some((h) => hueDelta(h, rx.hue) < OVERLAP_TOLERANCE);
		if (!tooClose) {
			refs.push({
				name: rx.name,
				hue: rx.hue,
				hex: previewHexForHue(rx.hue),
				source: 'Radix',
				relativeChroma: candidateRelativeChroma(rx.hue)
			});
		}
	}

	return refs;
}

// ── Preview hex generator ───────────────────────────────────────────

function previewHexForHue(hue: number): string {
	const { L } = TARGET_CURVE[300];
	const clampedC = clampChromaToGamut(L, ANCHOR_REF_CHROMA, hue);
	const { r, g, b } = oklchToRgb(L, clampedC, hue);
	return rgbToHex(r, g, b);
}

// ── Main analysis ───────────────────────────────────────────────────

/**
 * Analyse hue gaps and return ranked, multi-signal suggestions.
 *
 * @param uploadedDots - HueDot[] from all current palette families
 * @returns Object containing suggestions and coverage statistics
 */
export function analyseHueGaps(uploadedDots: HueDot[]): GapSuggestion[] {
	if (uploadedDots.length < 2) return [];

	const currentSize = uploadedDots.length;
	const remainingSlots = Math.max(0, MAX_PALETTE_SIZE - currentSize);

	// If palette is full, no suggestions
	if (remainingSlots === 0) return [];

	// Sort dots by hue
	const sorted: HueEntry[] = [...uploadedDots]
		.sort((a, b) => a.hue - b.hue)
		.map((d) => ({ name: d.name, hue: d.hue }));

	// Compute palette chroma stats for chroma-compatibility scoring
	const medianRelChroma = computeMedianRelativeChroma(uploadedDots);

	// Compute warm/cool balance for balance scoring
	const balance = computeBalance(sorted);

	// Dynamic threshold based on current palette size
	const gapThreshold = dynamicGapThreshold(currentSize);

	// Build gaps (including wrap-around)
	const gaps: Array<{ from: HueEntry; to: HueEntry; size: number; midpoint: number }> = [];

	for (let i = 0; i < sorted.length; i++) {
		const from = sorted[i];
		const to = sorted[(i + 1) % sorted.length];
		const size = clockwiseDistance(from.hue, to.hue);

		if (size >= gapThreshold) {
			gaps.push({ from, to, size, midpoint: midpointHue(from.hue, to.hue) });
		}
	}

	// Sort gaps by size (largest first)
	gaps.sort((a, b) => b.size - a.size);

	// Build reference palette excluding colours already present
	const existingHues = sorted.map((e) => e.hue);
	const refs = buildReferenceColors(existingHues);

	// Score and rank candidates across all gaps
	const allCandidates: ScoredCandidate[] = [];

	for (const gap of gaps) {
		const candidates = refs.filter((r) => isInArc(r.hue, gap.from.hue, gap.to.hue));
		if (candidates.length === 0) continue;

		for (const c of candidates) {
			const scored = scoreCandidate(c, gap, medianRelChroma, balance);
			allCandidates.push(scored);
		}
	}

	// Deduplicate: if the same ref appears in multiple gaps, keep the best score
	const bestByName = new Map<string, ScoredCandidate>();
	for (const c of allCandidates) {
		const key = `${c.name}-${c.source}`;
		const existing = bestByName.get(key);
		if (!existing || c.compositeScore > existing.compositeScore) {
			bestByName.set(key, c);
		}
	}

	// Sort by composite score (highest first)
	const ranked = [...bestByName.values()].sort((a, b) => b.compositeScore - a.compositeScore);

	// Take up to remainingSlots suggestions
	const take = Math.min(ranked.length, remainingSlots);

	// Map to GapSuggestion, finding the gap each belongs to
	const suggestions: GapSuggestion[] = [];
	for (let i = 0; i < take; i++) {
		const c = ranked[i];
		const gap = gaps.find((g) => isInArc(c.hue, g.from.hue, g.to.hue));
		if (!gap) continue;

		suggestions.push({
			name: c.name,
			source: c.source,
			hex: c.hex,
			hue: c.hue,
			gapSize: gap.size,
			between: [gap.from.name, gap.to.name],
			score: c.compositeScore,
			hueScore: c.hueScore,
			chromaScore: c.chromaScore,
			balanceScore: c.balanceScore,
			rationale: c.rationale
		});
	}

	return suggestions;
}

// ── Candidate scoring ───────────────────────────────────────────────

/**
 * Score a candidate colour using three weighted signals:
 *
 * 1. **Hue centrality** (40% weight) — how close the candidate is to the
 *    midpoint of the gap it fills. Centred candidates split gaps evenly.
 *
 * 2. **Chroma compatibility** (35% weight) — how well the candidate's
 *    natural relative chroma matches the palette's median. A score of 1.0
 *    means the candidate would have identical perceptual saturation to the
 *    palette average, ensuring visual harmony.
 *
 * 3. **Balance correction** (25% weight) — if the palette is warm-heavy,
 *    cool candidates get a boost, and vice versa. Neutral-zone candidates
 *    (yellow-greens, blue-violets) get a partial boost either way.
 */
function scoreCandidate(
	candidate: { name: string; hue: number; hex: string; source: 'Tailwind' | 'Spectrum' | 'Radix'; relativeChroma: number },
	gap: { midpoint: number; size: number },
	medianRelChroma: number,
	balance: { warmCount: number; coolCount: number; bias: 'balanced' | 'warm-heavy' | 'cool-heavy' }
): ScoredCandidate {
	// 1. Hue centrality: 1.0 at midpoint, 0.0 at gap edge
	const distFromMidpoint = hueDelta(candidate.hue, gap.midpoint);
	const maxDist = gap.size / 2;
	const hueScore = maxDist > 0 ? Math.max(0, 1 - (distFromMidpoint / maxDist)) : 1;

	// 2. Chroma compatibility: 1.0 when relative chroma matches median exactly
	const chromaDiff = Math.abs(candidate.relativeChroma - medianRelChroma);
	// Normalise: a difference of 0.3 (30% relative chroma) scores 0, anything closer scores linearly higher
	const chromaScore = Math.max(0, 1 - (chromaDiff / 0.3));

	// 3. Balance correction: 1.0 if the candidate corrects the imbalance
	let balanceScore = 0.5; // neutral by default
	const candidateZone = classifyHue(candidate.hue);
	if (balance.bias === 'warm-heavy') {
		if (candidateZone === 'cool') balanceScore = 1.0;
		else if (candidateZone === 'neutral') balanceScore = 0.7;
		else balanceScore = 0.2;
	} else if (balance.bias === 'cool-heavy') {
		if (candidateZone === 'warm') balanceScore = 1.0;
		else if (candidateZone === 'neutral') balanceScore = 0.7;
		else balanceScore = 0.2;
	}

	// Weighted composite
	const compositeScore = (hueScore * 0.40) + (chromaScore * 0.35) + (balanceScore * 0.25);

	// Build rationale string
	const rationaleChunks: string[] = [];

	if (hueScore >= 0.8) {
		rationaleChunks.push(`centres a ${gap.size.toFixed(0)}° gap`);
	} else {
		rationaleChunks.push(`fills a ${gap.size.toFixed(0)}° gap`);
	}

	if (chromaScore >= 0.8) {
		rationaleChunks.push('excellent chroma match');
	} else if (chromaScore >= 0.5) {
		rationaleChunks.push('good chroma compatibility');
	} else {
		rationaleChunks.push('chroma may need adjustment');
	}

	if (balance.bias !== 'balanced') {
		if (balanceScore >= 0.8) {
			rationaleChunks.push(`corrects ${balance.bias.replace('-', ' ')} palette`);
		}
	}

	return {
		name: candidate.name,
		hue: candidate.hue,
		hex: candidate.hex,
		source: candidate.source,
		hueScore,
		chromaScore,
		balanceScore,
		compositeScore,
		rationale: rationaleChunks.join(' · ')
	};
}

// ── Statistical helpers ─────────────────────────────────────────────

function computeMedianRelativeChroma(dots: HueDot[]): number {
	const relChromas: number[] = [];
	const { L } = TARGET_CURVE[300];

	for (const dot of dots) {
		const maxC = maxChromaAtLH(L, dot.hue);
		if (maxC <= 0) continue;
		const clampedC = clampChromaToGamut(L, ANCHOR_REF_CHROMA, dot.hue);
		relChromas.push(clampedC / maxC);
	}

	if (relChromas.length === 0) return 0.5;
	relChromas.sort((a, b) => a - b);
	const mid = Math.floor(relChromas.length / 2);
	return relChromas.length % 2 === 0
		? (relChromas[mid - 1] + relChromas[mid]) / 2
		: relChromas[mid];
}

function computeBalance(sorted: HueEntry[]): {
	warmCount: number;
	coolCount: number;
	neutralCount: number;
	bias: 'balanced' | 'warm-heavy' | 'cool-heavy';
} {
	let warmCount = 0;
	let coolCount = 0;
	let neutralCount = 0;

	for (const entry of sorted) {
		const zone = classifyHue(entry.hue);
		if (zone === 'warm') warmCount++;
		else if (zone === 'cool') coolCount++;
		else neutralCount++;
	}

	const total = warmCount + coolCount;
	let bias: 'balanced' | 'warm-heavy' | 'cool-heavy' = 'balanced';

	// Consider it imbalanced if one hemisphere has 2× or more colours than the other
	// (and there are at least 4 colours to make a meaningful comparison)
	if (total >= 4) {
		if (warmCount >= coolCount * 2) bias = 'warm-heavy';
		else if (coolCount >= warmCount * 2) bias = 'cool-heavy';
	}

	return { warmCount, coolCount, neutralCount, bias };
}

/**
 * Compute coverage statistics for the current palette.
 * Used by the audit score and the UI capacity indicator.
 */
export function computeCoverageStats(dots: HueDot[]): CoverageStats {
	const n = dots.length;
	const remainingSlots = Math.max(0, MAX_PALETTE_SIZE - n);
	const idealGap = n > 0 ? 360 / n : 360;

	// Compute actual gaps
	const sorted = [...dots].sort((a, b) => a.hue - b.hue);
	const gapSizes: number[] = [];
	for (let i = 0; i < sorted.length; i++) {
		const from = sorted[i];
		const to = sorted[(i + 1) % sorted.length];
		gapSizes.push(clockwiseDistance(from.hue, to.hue));
	}

	const meanGap = gapSizes.length > 0
		? gapSizes.reduce((s, g) => s + g, 0) / gapSizes.length
		: 360;

	const variance = gapSizes.length > 0
		? gapSizes.reduce((s, g) => s + (g - meanGap) ** 2, 0) / gapSizes.length
		: 0;
	const gapStdDev = Math.sqrt(variance);

	const balance = computeBalance(sorted.map((d) => ({ name: d.name, hue: d.hue })));

	return {
		remainingSlots,
		idealGap,
		meanGap,
		gapStdDev,
		...balance,
		balance: balance.bias
	};
}

// ── Exports for hue wheel ───────────────────────────────────────────

export function suggestionsToHueDots(suggestions: GapSuggestion[]): HueDot[] {
	return suggestions.map((s) => ({
		name: s.name,
		hue: s.hue,
		hex: s.hex,
		source: 'suggestion' as const
	}));
}
