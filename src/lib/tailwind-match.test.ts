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
		// This is amber-500 (#F59E0B), should match Amber
		const result = findClosestTailwind('#F59E0B');
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
		const orange = findClosestTailwind('#D57235');
		const amber = findClosestTailwind('#F59E0B');
		// Design system orange is a true warm orange; Figma amber is more golden
		expect(orange.name).not.toBe(amber.name);
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
});
