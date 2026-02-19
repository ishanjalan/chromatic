import { describe, it, expect } from 'vitest';
import {
	runPaletteAudit,
	analyseChroma,
	analyseProximity,
	computeShade300Tweaks
} from './palette-audit';
import type { ScoreBreakdown } from './palette-audit';
import type { ParsedFamily } from './parse-tokens';
import { hexToRgb, rgbToOklch, maxChromaAtLH } from './colour';

// Helper: create a ParsedFamily with just a 300 shade
function family(name: string, hex300: string): ParsedFamily {
	return {
		name,
		shades: {
			50: '#FFFFFF', 100: '#EEEEEE', 200: '#BBBBBB',
			300: hex300,
			400: '#333333', 500: '#222222'
		},
		complete: true
	};
}

// Helper: extract oklch for a hex
function toOklch(hex: string) {
	const { r, g, b } = hexToRgb(hex);
	return rgbToOklch(r, g, b);
}

const TWELVE_FAMILIES: ParsedFamily[] = [
	family('Purple', '#7E42EB'),
	family('Indigo', '#5258E4'),
	family('Blue', '#285BF3'),
	family('Cyan', '#0171A0'),
	family('Teal', '#017677'),
	family('Green', '#007B28'),
	family('Yellow', '#876400'),
	family('Olive', '#756A1E'),
	family('Orange', '#B14B00'),
	family('Red', '#D63941'),
	family('Magenta', '#C82169'),
	family('Fuchsia', '#C51986'),
];

describe('analyseChroma', () => {
	it('computes relative chroma for all families', () => {
		const families = TWELVE_FAMILIES.map((f) => {
			const oklch = toOklch(f.shades[300]);
			return { name: f.name, hex300: f.shades[300], oklch };
		});

		const results = analyseChroma(families);
		expect(results).toHaveLength(12);

		for (const r of results) {
			expect(r.relativeChroma).toBeGreaterThan(0);
			expect(r.relativeChroma).toBeLessThan(1.01); // allow tiny overshoot from binary search epsilon
			expect(r.maxChroma).toBeGreaterThan(0);
			expect(r.targetRelChroma).toBeGreaterThan(0);
			expect(typeof r.deviation).toBe('number');
		}
	});

	it('sets a reasonable median target', () => {
		const families = TWELVE_FAMILIES.map((f) => {
			const oklch = toOklch(f.shades[300]);
			return { name: f.name, hex300: f.shades[300], oklch };
		});

		const results = analyseChroma(families);
		const target = results[0].targetRelChroma;
		expect(target).toBeGreaterThan(0.3);
		expect(target).toBeLessThan(0.95);
	});

	it('flags families that deviate more than 5% from median', () => {
		const families = TWELVE_FAMILIES.map((f) => {
			const oklch = toOklch(f.shades[300]);
			return { name: f.name, hex300: f.shades[300], oklch };
		});

		const results = analyseChroma(families);
		const flagged = results.filter((r) => r.flagged);

		for (const f of flagged) {
			expect(Math.abs(f.deviation)).toBeGreaterThan(0.05);
		}

		const unflagged = results.filter((r) => !r.flagged);
		for (const u of unflagged) {
			expect(Math.abs(u.deviation)).toBeLessThanOrEqual(0.05);
		}
	});

	it('suggests valid hex values for flagged families', () => {
		const families = TWELVE_FAMILIES.map((f) => {
			const oklch = toOklch(f.shades[300]);
			return { name: f.name, hex300: f.shades[300], oklch };
		});

		const results = analyseChroma(families);
		for (const r of results) {
			if (r.flagged) {
				expect(r.suggestedHex300).toMatch(/^#[0-9A-F]{6}$/);
				expect(r.suggestedHex300).not.toBe(r.hex300);
			}
		}
	});

	it('returns empty for empty input', () => {
		expect(analyseChroma([])).toEqual([]);
	});
});

describe('analyseProximity', () => {
	it('does not flag Fuchsia/Magenta at 12.8° (above 10° threshold)', () => {
		const families = TWELVE_FAMILIES.map((f) => {
			const oklch = toOklch(f.shades[300]);
			return { name: f.name, hex300: f.shades[300], oklch };
		});

		const warnings = analyseProximity(families);
		const fuchsiaMagenta = warnings.find(
			(w) =>
				(w.familyA === 'Fuchsia' && w.familyB === 'Magenta') ||
				(w.familyA === 'Magenta' && w.familyB === 'Fuchsia')
		);

		// 12.8° is above the 10° warning threshold — Tailwind has pairs at 7-9°
		expect(fuchsiaMagenta).toBeUndefined();
	});

	it('does not flag Yellow/Olive at 16.4° (above 10° threshold)', () => {
		const families = TWELVE_FAMILIES.map((f) => {
			const oklch = toOklch(f.shades[300]);
			return { name: f.name, hex300: f.shades[300], oklch };
		});

		const warnings = analyseProximity(families);
		const yellowOlive = warnings.find(
			(w) =>
				(w.familyA === 'Yellow' && w.familyB === 'Olive') ||
				(w.familyA === 'Olive' && w.familyB === 'Yellow')
		);

		// 16.4° is well above threshold — these are distinct families in all major design systems
		expect(yellowOlive).toBeUndefined();
	});

	it('detects truly close hues (< 10°) as warnings with shift suggestion', () => {
		const close = [
			{ name: 'A', hex300: '#D63941', oklch: { L: 0.5, C: 0.15, H: 0 } },
			{ name: 'B', hex300: '#007B28', oklch: { L: 0.5, C: 0.15, H: 8 } },
			{ name: 'C', hex300: '#285BF3', oklch: { L: 0.5, C: 0.15, H: 180 } },
		];
		const warnings = analyseProximity(close);
		const ab = warnings.find(w => (w.familyA === 'A' && w.familyB === 'B') || (w.familyA === 'B' && w.familyB === 'A'));
		expect(ab).toBeDefined();
		expect(ab!.severity).toBe('warning');
		expect(ab!.suggestedAction).toBe('shift');
		expect(ab!.shiftTarget).toBeDefined();
		expect(ab!.shiftedHue).toBeDefined();
		expect(ab!.shiftedHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
		expect(ab!.shiftDirection).toBeDefined();
	});

	it('detects critically close hues (< 5°) as critical with merge suggestion', () => {
		const veryClose = [
			{ name: 'A', hex300: '#D63941', oklch: { L: 0.5, C: 0.15, H: 0 } },
			{ name: 'B', hex300: '#007B28', oklch: { L: 0.5, C: 0.15, H: 3 } },
			{ name: 'C', hex300: '#285BF3', oklch: { L: 0.5, C: 0.15, H: 180 } },
		];
		const warnings = analyseProximity(veryClose);
		const ab = warnings.find(w => (w.familyA === 'A' && w.familyB === 'B') || (w.familyA === 'B' && w.familyB === 'A'));
		expect(ab).toBeDefined();
		expect(ab!.severity).toBe('critical');
		expect(ab!.suggestedAction).toBe('merge');
		expect(ab!.shiftTarget).toBeUndefined();
	});

	it('returns empty for fewer than 2 families', () => {
		expect(analyseProximity([])).toEqual([]);
		const single = [{ name: 'Red', hex300: '#D63941', oklch: toOklch('#D63941') }];
		expect(analyseProximity(single)).toEqual([]);
	});

	it('returns no warnings for well-spaced families', () => {
		const wellSpaced = [
			{ name: 'A', hex300: '#D63941', oklch: { L: 0.5, C: 0.15, H: 0 } },
			{ name: 'B', hex300: '#007B28', oklch: { L: 0.5, C: 0.15, H: 120 } },
			{ name: 'C', hex300: '#285BF3', oklch: { L: 0.5, C: 0.15, H: 240 } },
		];
		expect(analyseProximity(wellSpaced)).toEqual([]);
	});
});

describe('computeShade300Tweaks', () => {
	it('suggests lightness normalisation for off-target families', () => {
		const tooLight = {
			name: 'TooLight',
			hex300: '#AABBCC',
			oklch: { L: 0.75, C: 0.03, H: 250 }
		};

		const chromaResults = analyseChroma([tooLight]);
		const tweaks = computeShade300Tweaks([tooLight], chromaResults);

		expect(tweaks.length).toBeGreaterThanOrEqual(1);
		const t = tweaks.find((t) => t.family === 'TooLight');
		expect(t).toBeDefined();
		expect(t!.reasons.some((r) => r.includes('Lightness'))).toBe(true);
	});

	it('suggests lightness normalisation for dark inputs too', () => {
		const tooDark = {
			name: 'TooDark',
			hex300: '#1A0033',
			oklch: { L: 0.15, C: 0.08, H: 300 }
		};

		const chromaResults = analyseChroma([tooDark]);
		const tweaks = computeShade300Tweaks([tooDark], chromaResults);

		expect(tweaks.length).toBeGreaterThanOrEqual(1);
		const t = tweaks.find((t) => t.family === 'TooDark');
		expect(t).toBeDefined();
		expect(t!.reasons.some((r) => r.includes('Lightness'))).toBe(true);
	});

	it('returns no tweaks when L is within tolerance of optimal target', () => {
		// L = 0.51 is within 0.06 of TARGET_CURVE[300].L (~0.492)
		const good = {
			name: 'Good',
			hex300: '#285BF3',
			oklch: { L: 0.51, C: 0.17, H: 264 }
		};

		// Single family = median chroma, so no chroma flag
		const chromaResults = analyseChroma([good]);
		const tweaks = computeShade300Tweaks([good], chromaResults);

		expect(tweaks).toHaveLength(0);
	});
});

describe('runPaletteAudit', () => {
	it('returns a complete audit result for 12 families', () => {
		const audit = runPaletteAudit(TWELVE_FAMILIES);

		expect(audit.familyCount).toBe(12);
		expect(audit.score).toBeGreaterThanOrEqual(0);
		expect(audit.score).toBeLessThanOrEqual(100);
		expect(audit.chromaAnalysis).toHaveLength(12);
		expect(audit.proximityWarnings.length).toBeGreaterThanOrEqual(0);
		expect(audit.gapSuggestions.length).toBeGreaterThanOrEqual(0);
		expect(audit.findings.length).toBeGreaterThan(0);
		expect(audit.wheelDots.length).toBeGreaterThanOrEqual(12);
		expect(audit.coverageStats).toBeDefined();
		expect(audit.coverageStats.remainingSlots).toBe(24 - 12);
	});

	it('returns findings sorted by severity (critical first)', () => {
		const audit = runPaletteAudit(TWELVE_FAMILIES);
		const order = { critical: 0, warning: 1, info: 2 };

		for (let i = 1; i < audit.findings.length; i++) {
			const prev = order[audit.findings[i - 1].severity as keyof typeof order];
			const curr = order[audit.findings[i].severity as keyof typeof order];
			expect(curr).toBeGreaterThanOrEqual(prev);
		}
	});

	it('includes proximity warnings in findings', () => {
		const audit = runPaletteAudit(TWELVE_FAMILIES);
		const proximityFindings = audit.findings.filter((f) => f.type === 'proximity');
		expect(proximityFindings.length).toBe(audit.proximityWarnings.length);
	});

	it('includes gap suggestions in findings', () => {
		const audit = runPaletteAudit(TWELVE_FAMILIES);
		const gapFindings = audit.findings.filter((f) => f.type === 'hue-gap');
		// Gap findings include per-suggestion entries plus potential balance/capacity notes
		expect(gapFindings.length).toBeGreaterThanOrEqual(audit.gapSuggestions.length);
	});

	it('wheelDots includes uploaded and suggestion dots', () => {
		const audit = runPaletteAudit(TWELVE_FAMILIES);
		const uploaded = audit.wheelDots.filter((d) => d.source === 'uploaded');
		const suggestions = audit.wheelDots.filter((d) => d.source === 'suggestion');
		expect(uploaded.length).toBe(12);
		expect(suggestions.length).toBe(audit.gapSuggestions.length);
	});

	it('returns empty audit for empty input', () => {
		const audit = runPaletteAudit([]);
		expect(audit.familyCount).toBe(0);
		expect(audit.score).toBeGreaterThanOrEqual(0);
		expect(audit.chromaAnalysis).toHaveLength(0);
		expect(audit.proximityWarnings).toHaveLength(0);
	});

	it('handles a palette with only 2 families', () => {
		const twoFamilies = [family('Red', '#D63941'), family('Blue', '#285BF3')];
		const audit = runPaletteAudit(twoFamilies);

		expect(audit.familyCount).toBe(2);
		expect(audit.chromaAnalysis).toHaveLength(2);
		expect(audit.gapSuggestions.length).toBeGreaterThan(0);
	});

	it('deducts score for chroma imbalance or other findings', () => {
		const audit = runPaletteAudit(TWELVE_FAMILIES);
		expect(audit.score).toBeLessThan(100);
	});

	it('includes scoreBreakdown with all category fields', () => {
		const audit = runPaletteAudit(TWELVE_FAMILIES);
		const bd = audit.scoreBreakdown;
		expect(bd).toBeDefined();

		// All fields should be numbers (0 or negative)
		const keys: (keyof ScoreBreakdown)[] = [
			'proximity', 'chromaImbalance', 'lightnessTweaks',
			'hueGaps', 'coverageUniformity', 'warmCoolBalance', 'familyCountAdj'
		];
		for (const k of keys) {
			expect(typeof bd[k]).toBe('number');
		}

		// Score should be consistent with breakdown sum
		const sum = 100 + bd.proximity + bd.chromaImbalance + bd.lightnessTweaks
			+ bd.hueGaps + bd.coverageUniformity + bd.warmCoolBalance + bd.familyCountAdj;
		expect(audit.score).toBe(Math.max(0, Math.min(100, sum)));
	});

	it('scoreBreakdown familyCountAdj is 0 for 12 families (between 12 and 15)', () => {
		const audit = runPaletteAudit(TWELVE_FAMILIES);
		// 12 families is >= 12, so no penalty; < 16 so no bonus
		expect(audit.scoreBreakdown.familyCountAdj).toBe(0);
	});

	it('scoreBreakdown familyCountAdj is -5 for fewer than 12 families', () => {
		const fewFamilies = TWELVE_FAMILIES.slice(0, 6);
		const audit = runPaletteAudit(fewFamilies);
		expect(audit.scoreBreakdown.familyCountAdj).toBe(-5);
	});

	it('proximity warnings include suggestedAction field', () => {
		const audit = runPaletteAudit(TWELVE_FAMILIES);
		for (const pw of audit.proximityWarnings) {
			expect(['merge', 'shift']).toContain(pw.suggestedAction);
			if (pw.suggestedAction === 'shift') {
				expect(pw.shiftTarget).toBeDefined();
				expect(pw.shiftedHue).toBeDefined();
				expect(pw.shiftedHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
			}
		}
	});

	it('produces critical proximity findings and deducts 15 from score', () => {
		// Create a palette with two critically close families (< 5° apart)
		const critPalette = [
			family('AlmostRed', '#D63941'),
			family('AlsoRed', '#D33E45'),
			family('Blue', '#285BF3'),
		];
		const audit = runPaletteAudit(critPalette);
		const critProx = audit.proximityWarnings.filter((w) => w.severity === 'critical');
		expect(critProx.length).toBeGreaterThan(0);
		expect(audit.scoreBreakdown.proximity).toBeLessThanOrEqual(-15);

		const proxFindings = audit.findings.filter((f) => f.type === 'proximity');
		expect(proxFindings.length).toBe(audit.proximityWarnings.length);
	});

	it('exercises reverse shift direction when first family name sorts after second', () => {
		const close = [
			{ name: 'Zed', hex300: '#D63941', oklch: { L: 0.5, C: 0.15, H: 0 } },
			{ name: 'Alpha', hex300: '#007B28', oklch: { L: 0.5, C: 0.15, H: 8 } },
			{ name: 'Mid', hex300: '#285BF3', oklch: { L: 0.5, C: 0.15, H: 180 } },
		];
		const warnings = analyseProximity(close);
		const pair = warnings.find(
			(w) => (w.familyA === 'Zed' && w.familyB === 'Alpha') || (w.familyA === 'Alpha' && w.familyB === 'Zed')
		);
		expect(pair).toBeDefined();
		expect(pair!.suggestedAction).toBe('shift');
		expect(pair!.shiftTarget).toBe('Zed');
	});

	it('adds capacity finding when palette has MAX_PALETTE_SIZE families', () => {
		const bigPalette = Array.from({ length: 24 }, (_, i) => {
			const hue = (i * 15) % 360;
			const rad = (hue * Math.PI) / 180;
			const r = Math.round(128 + 80 * Math.cos(rad));
			const g = Math.round(128 + 80 * Math.cos(rad - 2.094));
			const b = Math.round(128 + 80 * Math.cos(rad + 2.094));
			const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
			return family(`Color${i}`, hex);
		});
		const audit = runPaletteAudit(bigPalette);
		const capacityFinding = audit.findings.find((f) => f.message.includes('at capacity'));
		expect(capacityFinding).toBeDefined();
	});
});
