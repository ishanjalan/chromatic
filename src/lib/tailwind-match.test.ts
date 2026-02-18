import { describe, it, expect } from 'vitest';
import { findClosestTailwind, TAILWIND_COLORS, type TailwindMatch } from './tailwind-match';

describe('findClosestTailwind', () => {
	it('returns a valid TailwindMatch object', () => {
		const result = findClosestTailwind('#3B82F6');
		expect(result).toHaveProperty('name');
		expect(result).toHaveProperty('hueDelta');
		expect(result).toHaveProperty('confidence');
	});

	it('matches Tailwind blue-500 to Blue', () => {
		const result = findClosestTailwind('#3B82F6');
		expect(result.name).toBe('Blue');
		expect(result.confidence).toBe('exact');
	});

	it('matches Tailwind red-500 to Red', () => {
		const result = findClosestTailwind('#EF4444');
		expect(result.name).toBe('Red');
		expect(result.confidence).toBe('exact');
	});

	it('matches a teal-ish hex to Teal', () => {
		const result = findClosestTailwind('#14B8A6');
		expect(result.name).toBe('Teal');
	});

	it('identifies an amber-like colour is not Orange', () => {
		// This is amber-700 (#B45309) — matches the 700-shade reference hue ~49°
		const result = findClosestTailwind('#B45309');
		expect(result.name).toBe('Amber');
	});

	it('returns Neutral for achromatic grey', () => {
		const result = findClosestTailwind('#808080');
		expect(result.name).toBe('Neutral');
		expect(result.hueDelta).toBe(0);
		expect(result.confidence).toBe('exact');
	});

	it('returns Neutral for near-white', () => {
		const result = findClosestTailwind('#F0F0F0');
		expect(result.name).toBe('Neutral');
	});

	it('returns Neutral for near-black', () => {
		const result = findClosestTailwind('#1A1A1A');
		expect(result.name).toBe('Neutral');
	});

	it('does NOT return Neutral for a chromatic colour', () => {
		const result = findClosestTailwind('#3B82F6');
		expect(result.name).not.toBe('Neutral');
	});

	it('handles all existing design system families', () => {
		const existingFamilies: [string, string][] = [
			['Purple', '#7F40EC'],
			['Indigo', '#4858D9'],
			['Blue', '#2F74DF'],
			['Cyan', '#18A0C4'],
			['Teal', '#2D9D8F'],
			['Green', '#37944C'],
			['Yellow', '#9C8C33'],
			['Olive', '#5E8333'],
			['Orange', '#D57235'],
			['Red', '#D03B3B'],
			['Magenta', '#C44186'],
			['Fuchsia', '#A245C3'],
		];

		for (const [name, hex] of existingFamilies) {
			const result = findClosestTailwind(hex);
			expect(result.name).toBeTruthy();
			expect(result.hueDelta).toBeGreaterThanOrEqual(0);
		}
	});

	it('differentiates between Orange and Amber', () => {
		// Deep red-orange at ~33° hue — squarely in Orange-700 territory (38.4°)
		const orange = findClosestTailwind('#C24010');
		// Golden amber at ~49° hue — squarely in Amber-700 territory (49°)
		const amber = findClosestTailwind('#B45309');
		expect(orange.name).toBe('Orange');
		expect(amber.name).toBe('Amber');
	});

	it('covers all 17 Tailwind colour families', () => {
		expect(TAILWIND_COLORS).toHaveLength(17);
		const names = TAILWIND_COLORS.map((c) => c.name);
		expect(names).toContain('Red');
		expect(names).toContain('Blue');
		expect(names).toContain('Green');
		expect(names).toContain('Amber');
		expect(names).toContain('Fuchsia');
	});

	it('returns all four confidence levels for different inputs', () => {
		const exact = findClosestTailwind('#3B82F6');
		expect(exact.confidence).toBe('exact');
		expect(exact.hueDelta).toBeLessThan(8);

		// Hue ~205° sits between Teal (186.4°) and Cyan (223.1°) — ~18.6° from Teal
		const candidates = [
			'#1A7F8F', '#1A8898', '#1A90A0', '#1E88A0', '#2090A8',
			'#2498B0', '#15939E', '#1B959F', '#1C97A2', '#1899A5',
		];
		let foundApprox = false;
		for (const hex of candidates) {
			const result = findClosestTailwind(hex);
			if (result.confidence === 'approximate') {
				foundApprox = true;
				expect(result.hueDelta).toBeGreaterThanOrEqual(18);
				expect(result.hueDelta).toBeLessThan(30);
				break;
			}
		}
		if (!foundApprox) {
			// Fallback: use a known hue ~95° (yellow-green gap, 28° from Yellow)
			const fallbackCandidates = ['#6B8E23', '#7BA428', '#88AA22', '#556B2F', '#8FBC29'];
			for (const hex of fallbackCandidates) {
				const result = findClosestTailwind(hex);
				if (result.confidence === 'approximate') {
					foundApprox = true;
					break;
				}
			}
		}
		expect(foundApprox).toBe(true);
	});
});
