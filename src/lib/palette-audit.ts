/**
 * Palette Audit Engine — comprehensive analysis of an uploaded colour palette.
 *
 * Analyses:
 * 1. Chroma normalization — are all families perceptually equal in strength?
 * 2. Hue collisions — are any families too close in hue to distinguish?
 * 3. 300-shade optimization — do any anchors need L or C adjustments?
 * 4. Gap suggestions — what colours should be added? (delegates to gap-analysis.ts)
 */

import type { OklchColor } from './colour';
import {
	hexToRgb,
	rgbToOklch,
	rgbToHex,
	oklchToRgb,
	maxChromaAtLH,
	effectiveMaxChroma,
	clampChromaToGamut,
	hueDelta
} from './colour';
import { TARGET_CURVE, ACHROMATIC_THRESHOLD, MAX_PALETTE_SIZE, REFERENCE_HUE, CUSP_DAMPING_BASE, CUSP_DAMPING_COEFF } from './constants';
import type { ParsedFamily } from './parse-tokens';
import { familiesToHueDots } from './parse-tokens';
import { analyseHueGaps, suggestionsToHueDots, computeCoverageStats } from './gap-analysis';
import type { GapSuggestion, CoverageStats } from './gap-analysis';
import type { HueDot } from './components/HueWheel.svelte';

// ── Interfaces ──────────────────────────────────────────────────────

export interface ChromaAnalysis {
	family: string;
	hex300: string;
	oklch: OklchColor;
	maxChroma: number;
	relativeChroma: number;
	targetRelChroma: number;
	suggestedC: number;
	suggestedHex300: string;
	/** Signed deviation from target: positive = oversaturated, negative = undersaturated */
	deviation: number;
	/** Whether this family is flagged for chroma adjustment (|deviation| > threshold) */
	flagged: boolean;
}

export interface ProximityWarning {
	familyA: string;
	familyB: string;
	hueA: number;
	hueB: number;
	hueDelta: number;
	severity: 'critical' | 'warning';
	suggestion: string;
	suggestedAction: 'merge' | 'shift';
	shiftTarget?: string;
	shiftDirection?: number;
	shiftedHue?: number;
	shiftedHex?: string;
}

export interface Shade300Tweak {
	family: string;
	currentHex: string;
	suggestedHex: string;
	currentOklch: OklchColor;
	suggestedOklch: OklchColor;
	reasons: string[];
	/** Approximate perceptual distance (Oklch Euclidean in L,C space) */
	deltaE: number;
}

export type FindingSeverity = 'info' | 'warning' | 'critical';

export interface AuditFinding {
	type: 'proximity' | 'chroma-imbalance' | 'hue-gap' | 'shade300-tweak';
	severity: FindingSeverity;
	family?: string;
	message: string;
}

export interface ScoreBreakdown {
	proximity: number;
	chromaImbalance: number;
	lightnessTweaks: number;
	hueGaps: number;
	coverageUniformity: number;
	warmCoolBalance: number;
	familyCountAdj: number;
}

export interface PaletteAudit {
	score: number;
	scoreBreakdown: ScoreBreakdown;
	familyCount: number;
	chromaAnalysis: ChromaAnalysis[];
	proximityWarnings: ProximityWarning[];
	shade300Tweaks: Shade300Tweak[];
	gapSuggestions: GapSuggestion[];
	findings: AuditFinding[];
	/** All dots for the hue wheel (uploaded + suggestions) */
	wheelDots: HueDot[];
	/** Coverage uniformity statistics */
	coverageStats: CoverageStats;
}

// ── Thresholds ──────────────────────────────────────────────────────

const PROXIMITY_CRITICAL = 5;   // degrees — effectively identical hues
const PROXIMITY_WARNING = 10;   // degrees — genuinely close; Tailwind has pairs at 7-9°
const CHROMA_DEVIATION_THRESHOLD = 0.05; // 5% relative chroma

// ── Helpers ─────────────────────────────────────────────────────────

function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? (sorted[mid - 1] + sorted[mid]) / 2
		: sorted[mid];
}

/** Approximate perceptual distance in Oklch (L,C components only). */
function deltaE(a: OklchColor, b: OklchColor): number {
	return Math.sqrt((a.L - b.L) ** 2 + (a.C - b.C) ** 2);
}

interface FamilyOklch {
	name: string;
	hex300: string;
	oklch: OklchColor;
}

function extractFamilyOklch(families: ParsedFamily[]): FamilyOklch[] {
	const results: FamilyOklch[] = [];
	for (const fam of families) {
		const hex = fam.shades[300];
		if (!hex) continue;
		const { r, g, b } = hexToRgb(hex);
		const oklch = rgbToOklch(r, g, b);
		if (oklch.C < ACHROMATIC_THRESHOLD) continue; // skip achromatic
		results.push({ name: fam.name, hex300: hex, oklch });
	}
	return results;
}

// ── Analysis passes ─────────────────────────────────────────────────

export function analyseChroma(families: FamilyOklch[]): ChromaAnalysis[] {
	if (families.length === 0) return [];

	const analyses: ChromaAnalysis[] = families.map((fam) => {
		const maxC = effectiveMaxChroma(fam.oklch.L, fam.oklch.H, REFERENCE_HUE, CUSP_DAMPING_BASE, CUSP_DAMPING_COEFF);
		const relC = maxC > 0 ? fam.oklch.C / maxC : 0;
		return {
			family: fam.name,
			hex300: fam.hex300,
			oklch: fam.oklch,
			maxChroma: maxC,
			relativeChroma: relC,
			targetRelChroma: 0, // filled below
			suggestedC: 0,
			suggestedHex300: fam.hex300,
			deviation: 0,
			flagged: false
		};
	});

	const target = median(analyses.map((a) => a.relativeChroma));

	for (const a of analyses) {
		a.targetRelChroma = target;
		a.deviation = a.relativeChroma - target;
		a.flagged = Math.abs(a.deviation) > CHROMA_DEVIATION_THRESHOLD;

		if (a.flagged) {
			const newC = clampChromaToGamut(a.oklch.L, target * a.maxChroma, a.oklch.H);
			a.suggestedC = newC;
			const rgb = oklchToRgb(a.oklch.L, newC, a.oklch.H);
			a.suggestedHex300 = rgbToHex(rgb.r, rgb.g, rgb.b);
		} else {
			a.suggestedC = a.oklch.C;
			a.suggestedHex300 = a.hex300;
		}
	}

	return analyses;
}

export function analyseProximity(families: FamilyOklch[]): ProximityWarning[] {
	if (families.length < 2) return [];

	const sorted = [...families].sort((a, b) => a.oklch.H - b.oklch.H);
	const warnings: ProximityWarning[] = [];

	for (let i = 0; i < sorted.length; i++) {
		const a = sorted[i];
		const bIdx = (i + 1) % sorted.length;
		const b = sorted[bIdx];
		const delta = hueDelta(a.oklch.H, b.oklch.H);

		if (delta >= PROXIMITY_WARNING) continue;

		const isCritical = delta < PROXIMITY_CRITICAL;
		const suggestedAction: 'merge' | 'shift' = isCritical ? 'merge' : 'shift';

		let shiftTarget: string | undefined;
		let shiftDirection: number | undefined;
		let shiftedHue: number | undefined;
		let shiftedHex: string | undefined;

		if (!isCritical) {
			// For shift: determine which family has more room on its other side
			const prevIdxA = (i - 1 + sorted.length) % sorted.length;
			const nextIdxB = (bIdx + 1) % sorted.length;
			const roomA = hueDelta(sorted[prevIdxA].oklch.H, a.oklch.H);
			const roomB = hueDelta(b.oklch.H, sorted[nextIdxB].oklch.H);

			if (roomB >= roomA) {
				// Shift B away from A (clockwise)
				shiftTarget = b.name;
				const targetHue = (b.oklch.H + roomB / 2) % 360;
				shiftedHue = targetHue;
				shiftDirection = roomB / 2;
				const newC = clampChromaToGamut(b.oklch.L, b.oklch.C, targetHue);
				const rgb = oklchToRgb(b.oklch.L, newC, targetHue);
				shiftedHex = rgbToHex(rgb.r, rgb.g, rgb.b);
			} else {
				// Shift A away from B (counter-clockwise)
				shiftTarget = a.name;
				const targetHue = (a.oklch.H - roomA / 2 + 360) % 360;
				shiftedHue = targetHue;
				shiftDirection = -(roomA / 2);
				const newC = clampChromaToGamut(a.oklch.L, a.oklch.C, targetHue);
				const rgb = oklchToRgb(a.oklch.L, newC, targetHue);
				shiftedHex = rgbToHex(rgb.r, rgb.g, rgb.b);
			}
		}

		const suggestion = isCritical
			? `${a.name} and ${b.name} are only ${delta.toFixed(1)}° apart — they will be nearly indistinguishable. Consider merging them into one family.`
			: `${a.name} and ${b.name} are ${delta.toFixed(1)}° apart — they may look similar at lighter tints.${shiftTarget ? ` Shift ${shiftTarget} ${Math.abs(shiftDirection!).toFixed(0)}° ${shiftDirection! > 0 ? 'clockwise' : 'counter-clockwise'} to increase separation.` : ''}`;

		warnings.push({
			familyA: a.name,
			familyB: b.name,
			hueA: a.oklch.H,
			hueB: b.oklch.H,
			hueDelta: delta,
			severity: isCritical ? 'critical' : 'warning',
			suggestion,
			suggestedAction,
			shiftTarget,
			shiftDirection,
			shiftedHue,
			shiftedHex
		});
	}

	return warnings;
}

export function computeShade300Tweaks(
	families: FamilyOklch[],
	chromaResults: ChromaAnalysis[]
): Shade300Tweak[] {
	const tweaks: Shade300Tweak[] = [];
	const chromaMap = new Map(chromaResults.map((c) => [c.family, c]));

	for (const fam of families) {
		const reasons: string[] = [];
		let newL = fam.oklch.L;
		let newC = fam.oklch.C;
		const H = fam.oklch.H;

		// Flag lightness only when significantly off the APCA-optimised target.
		// A tolerance of 0.06 (~6% Oklch L) keeps the audit from flagging
		// minor deviations that don't meaningfully affect contrast or perception.
		// Only families far enough from the optimal L to impact APCA compliance
		// get a normalisation suggestion.
		const optimalL = TARGET_CURVE[300].L;
		const lDelta = Math.abs(fam.oklch.L - optimalL);
		if (lDelta > 0.06) {
			newL = optimalL;
			reasons.push(`Lightness ${fam.oklch.L.toFixed(3)} is ${lDelta > 0.10 ? 'significantly ' : ''}off the optimal L* ${optimalL.toFixed(3)} — normalised for APCA compliance`);
		}

		// Check chroma normalization
		const chroma = chromaMap.get(fam.name);
		if (chroma?.flagged) {
			newC = chroma.suggestedC;
			const direction = chroma.deviation > 0 ? 'oversaturated' : 'undersaturated';
			reasons.push(`Chroma is ${Math.abs(chroma.deviation * 100).toFixed(1)}% ${direction} relative to palette median — adjusted for perceptual balance`);
		}

		// If lightness changed, re-clamp chroma at new L
		if (newL !== fam.oklch.L) {
			newC = clampChromaToGamut(newL, newC, H);
		}

		if (reasons.length === 0) continue;

		const clamped = clampChromaToGamut(newL, newC, H);
		const rgb = oklchToRgb(newL, clamped, H);
		const suggestedHex = rgbToHex(rgb.r, rgb.g, rgb.b);

		const suggestedOklch: OklchColor = { L: newL, C: clamped, H };
		const de = deltaE(fam.oklch, suggestedOklch);

		tweaks.push({
			family: fam.name,
			currentHex: fam.hex300,
			suggestedHex,
			currentOklch: fam.oklch,
			suggestedOklch,
			reasons,
			deltaE: de
		});
	}

	return tweaks;
}

// ── Scoring ─────────────────────────────────────────────────────────

function computeScore(
	proximity: ProximityWarning[],
	chromaResults: ChromaAnalysis[],
	tweaks: Shade300Tweak[],
	gapSuggestions: GapSuggestion[],
	familyCount: number,
	coverage: CoverageStats
): { score: number; breakdown: ScoreBreakdown } {
	const bd: ScoreBreakdown = {
		proximity: 0,
		chromaImbalance: 0,
		lightnessTweaks: 0,
		hueGaps: 0,
		coverageUniformity: 0,
		warmCoolBalance: 0,
		familyCountAdj: 0
	};

	for (const pw of proximity) {
		bd.proximity -= pw.severity === 'critical' ? 15 : 5;
	}

	for (const ca of chromaResults) {
		if (Math.abs(ca.deviation) > 0.10) bd.chromaImbalance -= 3;
	}

	for (const t of tweaks) {
		if (t.reasons.some((r) => r.includes('Lightness'))) bd.lightnessTweaks -= 5;
	}

	for (const gs of gapSuggestions) {
		if (gs.gapSize > 50) bd.hueGaps -= 3;
		else if (gs.gapSize > 35) bd.hueGaps -= 1;
	}

	if (familyCount >= 4 && coverage.gapStdDev > 0) {
		const idealGap = 360 / familyCount;
		const normalizedStdDev = coverage.gapStdDev / idealGap;
		bd.coverageUniformity = -Math.min(10, Math.round(normalizedStdDev * 10));
	}

	if (coverage.balance === 'warm-heavy' || coverage.balance === 'cool-heavy') {
		bd.warmCoolBalance = -3;
	}

	if (familyCount >= 16 && familyCount <= 20) bd.familyCountAdj = 5;
	else if (familyCount < 12) bd.familyCountAdj = -5;

	const raw = 100 + bd.proximity + bd.chromaImbalance + bd.lightnessTweaks
		+ bd.hueGaps + bd.coverageUniformity + bd.warmCoolBalance + bd.familyCountAdj;

	return { score: Math.max(0, Math.min(100, raw)), breakdown: bd };
}

// ── Main entry point ────────────────────────────────────────────────

export function runPaletteAudit(families: ParsedFamily[]): PaletteAudit {
	const familyOklch = extractFamilyOklch(families);
	const uploadedDots = familiesToHueDots(families);

	// Analysis passes
	const chromaAnalysis = analyseChroma(familyOklch);
	const proximityWarnings = analyseProximity(familyOklch);
	const shade300Tweaks = computeShade300Tweaks(familyOklch, chromaAnalysis);
	const gapSuggestions = analyseHueGaps(uploadedDots);
	const coverageStats = computeCoverageStats(uploadedDots);

	// Build findings (prioritised)
	const findings: AuditFinding[] = [];

	for (const pw of proximityWarnings) {
		findings.push({
			type: 'proximity',
			severity: pw.severity,
			message: pw.suggestion
		});
	}

	for (const ca of chromaAnalysis) {
		if (ca.flagged) {
			const direction = ca.deviation > 0 ? 'oversaturated' : 'undersaturated';
			findings.push({
				type: 'chroma-imbalance',
				severity: Math.abs(ca.deviation) > 0.10 ? 'warning' : 'info',
				family: ca.family,
				message: `${ca.family} is ${Math.abs(ca.deviation * 100).toFixed(1)}% ${direction} relative to palette median — it may appear ${ca.deviation > 0 ? 'more vivid' : 'more muted'} than its peers`
			});
		}
	}

	for (const tweak of shade300Tweaks) {
		findings.push({
			type: 'shade300-tweak',
			severity: tweak.reasons.some((r) => r.includes('Lightness')) ? 'warning' : 'info',
			family: tweak.family,
			message: `${tweak.family} 300 shade (${tweak.currentHex}) → suggested ${tweak.suggestedHex}: ${tweak.reasons.join('; ')}`
		});
	}

	for (const gs of gapSuggestions) {
		findings.push({
			type: 'hue-gap',
			severity: gs.gapSize > 50 ? 'warning' : 'info',
			message: `${gs.gapSize.toFixed(0)}° gap between ${gs.between[0]} and ${gs.between[1]} — consider adding ${gs.name} (${gs.source}): ${gs.rationale}`
		});
	}

	// Add coverage/balance findings
	if (coverageStats.balance !== 'balanced') {
		findings.push({
			type: 'hue-gap',
			severity: 'info',
			message: `Palette is ${coverageStats.balance.replace('-', ' ')}: ${coverageStats.warmCount} warm, ${coverageStats.coolCount} cool, ${coverageStats.neutralCount} transitional families — consider adding ${coverageStats.balance === 'warm-heavy' ? 'cooler' : 'warmer'} tones`
		});
	}

	if (coverageStats.remainingSlots === 0) {
		findings.push({
			type: 'hue-gap',
			severity: 'info',
			message: `Palette is at capacity (${families.length}/${MAX_PALETTE_SIZE}) — no further additions suggested`
		});
	}

	// Sort: critical first, then warning, then info
	const severityOrder: Record<FindingSeverity, number> = { critical: 0, warning: 1, info: 2 };
	findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

	// Hue wheel dots
	const suggestionDots = suggestionsToHueDots(gapSuggestions);
	const wheelDots: HueDot[] = [...uploadedDots, ...suggestionDots];

	// Score
	const { score, breakdown: scoreBreakdown } = computeScore(
		proximityWarnings,
		chromaAnalysis,
		shade300Tweaks,
		gapSuggestions,
		familyOklch.length,
		coverageStats
	);

	return {
		score,
		scoreBreakdown,
		familyCount: familyOklch.length,
		chromaAnalysis,
		proximityWarnings,
		shade300Tweaks,
		gapSuggestions,
		findings,
		wheelDots,
		coverageStats
	};
}
