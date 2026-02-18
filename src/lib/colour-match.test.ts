import { describe, it, expect } from 'vitest';
import { findClosestMulti, findTopMatches } from './colour-match';

describe('findClosestMulti', () => {
	it('returns matches from all three systems for a chromatic colour', () => {
		const result = findClosestMulti('#3B82F6');
		expect(result.isAchromatic).toBe(false);
		expect(result.tailwind).not.toBeNull();
		expect(result.spectrum).not.toBeNull();
		expect(result.radix).not.toBeNull();
	});

	it('each match has required properties', () => {
		const result = findClosestMulti('#EF4444');
		for (const match of [result.tailwind!, result.spectrum!, result.radix!]) {
			expect(match.name).toBeTruthy();
			expect(match.source).toBeTruthy();
			expect(typeof match.hueDelta).toBe('number');
			expect(['exact', 'close', 'approximate', 'distant']).toContain(match.confidence);
			expect(match.previewHex).toMatch(/^#[0-9A-F]{6}$/);
		}
	});

	it('returns null matches for achromatic input', () => {
		const result = findClosestMulti('#808080');
		expect(result.isAchromatic).toBe(true);
		expect(result.tailwind).toBeNull();
		expect(result.spectrum).toBeNull();
		expect(result.radix).toBeNull();
	});

	it('finds Blue-ish names for a blue input', () => {
		const result = findClosestMulti('#3B82F6');
		expect(result.tailwind!.hueDelta).toBeLessThan(30);
	});

	it('finds Red-ish names for a red input', () => {
		const result = findClosestMulti('#EF4444');
		expect(result.tailwind!.hueDelta).toBeLessThan(30);
	});
});

describe('findTopMatches', () => {
	it('returns up to the requested limit', () => {
		const matches = findTopMatches('#3B82F6', 5);
		expect(matches.length).toBeLessThanOrEqual(5);
		expect(matches.length).toBeGreaterThan(0);
	});

	it('returns results sorted by hue delta ascending', () => {
		const matches = findTopMatches('#22C55E', 10);
		for (let i = 1; i < matches.length; i++) {
			expect(matches[i].hueDelta).toBeGreaterThanOrEqual(matches[i - 1].hueDelta);
		}
	});

	it('returns empty array for achromatic input', () => {
		expect(findTopMatches('#808080')).toEqual([]);
		expect(findTopMatches('#FFFFFF')).toEqual([]);
	});

	it('includes matches from multiple sources', () => {
		const matches = findTopMatches('#3B82F6', 10);
		const sources = new Set(matches.map((m) => m.source));
		expect(sources.size).toBeGreaterThanOrEqual(2);
	});

	it('deduplicates same-name same-source entries', () => {
		const matches = findTopMatches('#FF0000', 20);
		const keys = matches.map((m) => `${m.source}:${m.name}`);
		expect(keys.length).toBe(new Set(keys).size);
	});

	it('generates valid preview hexes', () => {
		const matches = findTopMatches('#10B981', 5);
		for (const m of matches) {
			expect(m.previewHex).toMatch(/^#[0-9A-F]{6}$/);
		}
	});
});
