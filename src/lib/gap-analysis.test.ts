import { describe, it, expect } from 'vitest';
import { analyseHueGaps, suggestionsToHueDots } from './gap-analysis';
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
		// Two dots at 0° and 180° — 180° gap each side
		const dots = [dot('A', 0), dot('B', 180)];
		const suggestions = analyseHueGaps(dots);
		expect(suggestions.length).toBeGreaterThan(0);
		for (const s of suggestions) {
			expect(s.gapSize).toBeGreaterThanOrEqual(25);
			expect(s.name).toBeTruthy();
			expect(s.source).toMatch(/^(Tailwind|Spectrum)$/);
			expect(s.hex).toMatch(/^#[0-9A-F]{6}$/);
			expect(s.between).toHaveLength(2);
		}
	});

	it('returns no suggestions when hues are densely packed', () => {
		// Create dots every 20° — no gap exceeds 25°
		const dots = Array.from({ length: 18 }, (_, i) =>
			dot(`C${i}`, i * 20)
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
		// All suggestions should reference pairs from our 3 families
		const validNames = new Set(['Red', 'Green', 'Blue']);
		for (const s of suggestions) {
			expect(validNames.has(s.between[0])).toBe(true);
			expect(validNames.has(s.between[1])).toBe(true);
		}
	});

	it('ranks suggestions by gap size (largest first)', () => {
		const dots = [
			dot('A', 0),
			dot('B', 30),
			dot('C', 200)
		];
		const suggestions = analyseHueGaps(dots);
		for (let i = 1; i < suggestions.length; i++) {
			expect(suggestions[i].gapSize).toBeLessThanOrEqual(suggestions[i - 1].gapSize);
		}
	});

	it('handles wrap-around gap correctly', () => {
		// Gap from 350° back to 10° wrapping through 0°
		const dots = [dot('A', 10), dot('B', 350)];
		const suggestions = analyseHueGaps(dots);
		// The large gap (340°) should be detected between A and B
		const largeGap = suggestions.find((s) => s.gapSize > 300);
		expect(largeGap).toBeDefined();
	});

	it('produces up to 2 suggestions for very large gaps (>60°)', () => {
		// One massive gap: two dots 60° apart → 300° gap the other way
		const dots = [dot('A', 0), dot('B', 60)];
		const suggestions = analyseHueGaps(dots);
		const largeGapSuggestions = suggestions.filter((s) => s.gapSize > 60);
		expect(largeGapSuggestions.length).toBeGreaterThanOrEqual(1);
		// The large gap may have up to 2 suggestions
		const gapBetween = suggestions.filter(
			(s) => s.between[0] === 'B' && s.between[1] === 'A'
		);
		expect(gapBetween.length).toBeLessThanOrEqual(2);
	});

	it('does not suggest colours that overlap with uploaded families', () => {
		// Upload dots near Tailwind Red (25°) and Blue (260°)
		const dots = [
			dot('MyRed', 25),
			dot('MyBlue', 260)
		];
		const suggestions = analyseHueGaps(dots);
		for (const s of suggestions) {
			// No suggestion should be within 15° of any uploaded dot
			for (const d of dots) {
				const delta = Math.abs(s.hue - d.hue);
				const wrapped = delta > 180 ? 360 - delta : delta;
				expect(wrapped).toBeGreaterThanOrEqual(15);
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
		// With 12 families spread across the wheel, there might be small gaps
		// but all suggestions should be valid
		for (const s of suggestions) {
			expect(s.hue).toBeGreaterThanOrEqual(0);
			expect(s.hue).toBeLessThan(360);
			expect(s.gapSize).toBeGreaterThanOrEqual(25);
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
