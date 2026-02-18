import { describe, it, expect } from 'vitest';
import { analyseHueGaps, suggestionsToHueDots, computeCoverageStats } from './gap-analysis';
import { MAX_PALETTE_SIZE } from './constants';
import type { HueDot } from './components/HueWheel.svelte';

function dot(name: string, hue: number, hex = '#888888'): HueDot {
	return { name, hue, hex, source: 'uploaded' };
}

describe('analyseHueGaps', () => {
	it('returns empty for fewer than 2 dots', () => {
		expect(analyseHueGaps([])).toEqual([]);
		expect(analyseHueGaps([dot('Red', 25)])).toEqual([]);
	});

	it('returns suggestions for a large gap', () => {
		const dots = [dot('A', 0), dot('B', 180)];
		const suggestions = analyseHueGaps(dots);
		expect(suggestions.length).toBeGreaterThan(0);
		for (const s of suggestions) {
			expect(s.name).toBeTruthy();
			expect(s.source).toMatch(/^(Tailwind|Spectrum|Radix)$/);
			expect(s.hex).toMatch(/^#[0-9A-F]{6}$/);
			expect(s.between).toHaveLength(2);
			expect(s.score).toBeGreaterThan(0);
			expect(s.rationale).toBeTruthy();
			// Sub-scores must be present and in [0, 1]
			expect(s.hueScore).toBeGreaterThanOrEqual(0);
			expect(s.hueScore).toBeLessThanOrEqual(1);
			expect(s.chromaScore).toBeGreaterThanOrEqual(0);
			expect(s.chromaScore).toBeLessThanOrEqual(1);
			expect(s.balanceScore).toBeGreaterThanOrEqual(0);
			expect(s.balanceScore).toBeLessThanOrEqual(1);
		}
	});

	it('returns no suggestions when hues are densely packed', () => {
		// Create dots every 10° — no gap exceeds the dynamic threshold
		const dots = Array.from({ length: 36 }, (_, i) =>
			dot(`C${i}`, i * 10)
		);
		const suggestions = analyseHueGaps(dots);
		expect(suggestions).toEqual([]);
	});

	it('identifies the correct between-families for a gap', () => {
		const dots = [
			dot('Red', 20),
			dot('Green', 150),
			dot('Blue', 260)
		];
		const suggestions = analyseHueGaps(dots);
		const validNames = new Set(['Red', 'Green', 'Blue']);
		for (const s of suggestions) {
			expect(validNames.has(s.between[0])).toBe(true);
			expect(validNames.has(s.between[1])).toBe(true);
		}
	});

	it('ranks suggestions by composite score (highest first)', () => {
		const dots = [
			dot('A', 0),
			dot('B', 30),
			dot('C', 200)
		];
		const suggestions = analyseHueGaps(dots);
		for (let i = 1; i < suggestions.length; i++) {
			expect(suggestions[i].score).toBeLessThanOrEqual(suggestions[i - 1].score);
		}
	});

	it('handles wrap-around gap correctly', () => {
		const dots = [dot('A', 10), dot('B', 350)];
		const suggestions = analyseHueGaps(dots);
		// The large gap (340°) should produce suggestions
		expect(suggestions.length).toBeGreaterThan(0);
		const largeGap = suggestions.find((s) => s.gapSize > 300);
		expect(largeGap).toBeDefined();
	});

	it('does not suggest colours that overlap with uploaded families', () => {
		const dots = [
			dot('MyRed', 25),
			dot('MyBlue', 260)
		];
		const suggestions = analyseHueGaps(dots);
		for (const s of suggestions) {
			for (const d of dots) {
				const delta = Math.abs(s.hue - d.hue);
				const wrapped = delta > 180 ? 360 - delta : delta;
				expect(wrapped).toBeGreaterThanOrEqual(10);
			}
		}
	});

	it('works with the typical 12-family palette', () => {
		const palette = [
			dot('Purple', 310), dot('Indigo', 285), dot('Blue', 260),
			dot('Cyan', 220), dot('Teal', 180), dot('Green', 150),
			dot('Yellow', 95), dot('Olive', 120), dot('Orange', 55),
			dot('Red', 25), dot('Magenta', 350), dot('Fuchsia', 330)
		];
		const suggestions = analyseHueGaps(palette);
		for (const s of suggestions) {
			expect(s.hue).toBeGreaterThanOrEqual(0);
			expect(s.hue).toBeLessThan(360);
			expect(s.score).toBeGreaterThan(0);
			expect(typeof s.hueScore).toBe('number');
			expect(typeof s.chromaScore).toBe('number');
			expect(typeof s.balanceScore).toBe('number');
		}
	});

	it('respects MAX_PALETTE_SIZE cap', () => {
		// Create exactly MAX_PALETTE_SIZE dots — should produce no suggestions
		const dots = Array.from({ length: MAX_PALETTE_SIZE }, (_, i) =>
			dot(`C${i}`, (i * 360) / MAX_PALETTE_SIZE)
		);
		const suggestions = analyseHueGaps(dots);
		expect(suggestions).toEqual([]);
	});

	it('limits suggestions to remaining slots', () => {
		// Create a palette with only 2 families — many suggestions possible,
		// but should not exceed MAX_PALETTE_SIZE - 2
		const dots = [dot('A', 0), dot('B', 180)];
		const suggestions = analyseHueGaps(dots);
		expect(suggestions.length).toBeLessThanOrEqual(MAX_PALETTE_SIZE - 2);
	});

	it('includes rationale for each suggestion', () => {
		const dots = [dot('A', 0), dot('B', 180)];
		const suggestions = analyseHueGaps(dots);
		for (const s of suggestions) {
			expect(s.rationale).toBeTruthy();
			expect(typeof s.rationale).toBe('string');
		}
	});

	it('deduplicates candidates appearing in multiple gaps', () => {
		// A candidate near a gap junction could theoretically appear in two gaps
		const dots = [dot('A', 0), dot('B', 100), dot('C', 300)];
		const suggestions = analyseHueGaps(dots);
		const nameSourcePairs = suggestions.map((s) => `${s.name}-${s.source}`);
		const unique = new Set(nameSourcePairs);
		expect(unique.size).toBe(nameSourcePairs.length);
	});

	it('boosts cool candidates for a warm-heavy palette', () => {
		// Need at least 4 warm+cool dots for balance detection, with warm >= 2× cool
		const warmPalette = [
			dot('Red', 10), dot('Orange', 40), dot('Rose', 350), dot('Magenta', 330),
			dot('Teal', 180)
		];
		const stats = computeCoverageStats(warmPalette);
		expect(stats.balance).toBe('warm-heavy');
		const suggestions = analyseHueGaps(warmPalette);
		expect(suggestions.length).toBeGreaterThan(0);
		// Cool-zone suggestions should exist and have higher balance scores
		const coolSuggestions = suggestions.filter((s) => s.hue >= 120 && s.hue < 270);
		const warmSuggestions = suggestions.filter((s) => s.hue < 60 || s.hue >= 300);
		expect(coolSuggestions.length).toBeGreaterThan(0);
		if (warmSuggestions.length > 0 && coolSuggestions.length > 0) {
			const avgCoolBalance = coolSuggestions.reduce((sum, s) => sum + s.balanceScore, 0) / coolSuggestions.length;
			const avgWarmBalance = warmSuggestions.reduce((sum, s) => sum + s.balanceScore, 0) / warmSuggestions.length;
			expect(avgCoolBalance).toBeGreaterThan(avgWarmBalance);
		}
	});

	it('boosts warm candidates for a cool-heavy palette', () => {
		const coolPalette = [
			dot('Blue', 230), dot('Teal', 180), dot('Cyan', 200), dot('Green', 150),
			dot('Red', 10)
		];
		const stats = computeCoverageStats(coolPalette);
		expect(stats.balance).toBe('cool-heavy');
		const suggestions = analyseHueGaps(coolPalette);
		expect(suggestions.length).toBeGreaterThan(0);
		const warmSuggestions = suggestions.filter((s) => s.hue < 60 || s.hue >= 300);
		const coolSuggestions = suggestions.filter((s) => s.hue >= 120 && s.hue < 270);
		expect(warmSuggestions.length).toBeGreaterThan(0);
		if (warmSuggestions.length > 0 && coolSuggestions.length > 0) {
			const avgWarmBalance = warmSuggestions.reduce((sum, s) => sum + s.balanceScore, 0) / warmSuggestions.length;
			const avgCoolBalance = coolSuggestions.reduce((sum, s) => sum + s.balanceScore, 0) / coolSuggestions.length;
			expect(avgWarmBalance).toBeGreaterThan(avgCoolBalance);
		}
	});
});

describe('suggestionsToHueDots', () => {
	it('converts suggestions to HueDots with source=suggestion', () => {
		const suggestions = analyseHueGaps([dot('A', 0), dot('B', 180)]);
		const hueDots = suggestionsToHueDots(suggestions);
		expect(hueDots.length).toBe(suggestions.length);
		for (const d of hueDots) {
			expect(d.source).toBe('suggestion');
			expect(d.name).toBeTruthy();
			expect(d.hex).toMatch(/^#[0-9A-F]{6}$/i);
		}
	});

	it('returns empty array for no suggestions', () => {
		expect(suggestionsToHueDots([])).toEqual([]);
	});
});

describe('computeCoverageStats', () => {
	it('returns correct stats for a balanced palette', () => {
		const dots = [
			dot('Red', 20),     // warm
			dot('Orange', 50),  // warm
			dot('Green', 150),  // cool
			dot('Blue', 250),   // cool
		];
		const stats = computeCoverageStats(dots);
		expect(stats.remainingSlots).toBe(MAX_PALETTE_SIZE - 4);
		expect(stats.idealGap).toBe(90);
		expect(stats.warmCount).toBe(2);
		expect(stats.coolCount).toBe(2);
		expect(stats.balance).toBe('balanced');
	});

	it('detects warm-heavy palettes', () => {
		const dots = [
			dot('Red', 10),
			dot('Orange', 40),
			dot('Magenta', 340),
			dot('Rose', 5),
			dot('Blue', 250),
		];
		const stats = computeCoverageStats(dots);
		expect(stats.warmCount).toBe(4);
		expect(stats.coolCount).toBe(1);
		expect(stats.balance).toBe('warm-heavy');
	});

	it('detects cool-heavy palettes', () => {
		const dots = [
			dot('Green', 140),
			dot('Teal', 180),
			dot('Blue', 230),
			dot('Indigo', 260),
			dot('Red', 20),
		];
		const stats = computeCoverageStats(dots);
		expect(stats.coolCount).toBe(4);
		expect(stats.warmCount).toBe(1);
		expect(stats.balance).toBe('cool-heavy');
	});

	it('returns zero remaining slots when at capacity', () => {
		const dots = Array.from({ length: MAX_PALETTE_SIZE }, (_, i) =>
			dot(`C${i}`, (i * 360) / MAX_PALETTE_SIZE)
		);
		const stats = computeCoverageStats(dots);
		expect(stats.remainingSlots).toBe(0);
	});

	it('computes gap standard deviation', () => {
		// Two dots at 0° and 180° — perfectly uniform: stdDev should be ~0
		const dots = [dot('A', 0), dot('B', 180)];
		const stats = computeCoverageStats(dots);
		expect(stats.gapStdDev).toBeLessThan(1);
	});
});
