import { describe, it, expect } from 'vitest';
import { parseTokenJson, familiesToHueDots } from './parse-tokens';

const makeFamilyJson = (name: string, shades: Record<string, string>) => {
	const entries: Record<string, object> = {};
	for (const [level, hex] of Object.entries(shades)) {
		entries[level] = {
			$type: 'color',
			$value: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 1, hex }
		};
	}
	return { Colour: { [name]: entries } };
};

const FULL_SHADES = { '50': '#AABBCC', '100': '#AABBCC', '200': '#AABBCC', '300': '#AABBCC', '400': '#AABBCC', '500': '#AABBCC' };

describe('parseTokenJson', () => {
	it('parses a valid single-family JSON', () => {
		const json = JSON.stringify(makeFamilyJson('Purple', FULL_SHADES));
		const result = parseTokenJson(json);
		expect(result.families).toHaveLength(1);
		expect(result.families[0].name).toBe('Purple');
		expect(result.families[0].complete).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('handles multiple families', () => {
		const data = {
			Colour: {
				Purple: makeFamilyJson('Purple', FULL_SHADES).Colour.Purple,
				Blue: makeFamilyJson('Blue', FULL_SHADES).Colour.Blue
			}
		};
		const result = parseTokenJson(JSON.stringify(data));
		expect(result.families).toHaveLength(2);
	});

	it('marks incomplete families', () => {
		const partial = { '50': '#AABBCC', '300': '#AABBCC' };
		const json = JSON.stringify(makeFamilyJson('Test', partial));
		const result = parseTokenJson(json);
		expect(result.families).toHaveLength(1);
		expect(result.families[0].complete).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});

	it('ignores non-colour nodes', () => {
		const json = JSON.stringify({ Colour: { Numbers: { '50': { $type: 'number', $value: 42 } } } });
		const result = parseTokenJson(json);
		expect(result.families).toHaveLength(0);
	});

	it('handles invalid JSON gracefully', () => {
		const result = parseTokenJson('not json at all');
		expect(result.families).toHaveLength(0);
		expect(result.errors).toContain('Invalid JSON — could not parse the input.');
	});

	it('handles flat structure without Colour wrapper', () => {
		const flat: Record<string, object> = {};
		for (const [level, hex] of Object.entries(FULL_SHADES)) {
			flat[level] = { $type: 'color', $value: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 1, hex } };
		}
		const json = JSON.stringify({ TestFamily: flat });
		const result = parseTokenJson(json);
		expect(result.families).toHaveLength(1);
		expect(result.families[0].name).toBe('TestFamily');
	});

	it('skips intermediate shades (150, 250, 350)', () => {
		const withIntermediate = {
			...FULL_SHADES,
			'150': '#DDDDDD',
			'250': '#DDDDDD',
			'350': '#DDDDDD'
		};
		const json = JSON.stringify(makeFamilyJson('Test', withIntermediate));
		const result = parseTokenJson(json);
		expect(result.families[0].complete).toBe(true);
		expect(Object.keys(result.families[0].shades)).toHaveLength(6);
	});

	it('uppercases hex values', () => {
		const shades = { '50': '#aabbcc', '100': '#ddeeff', '200': '#112233', '300': '#445566', '400': '#778899', '500': '#aabb00' };
		const json = JSON.stringify(makeFamilyJson('Test', shades));
		const result = parseTokenJson(json);
		expect(result.families[0].shades[50]).toBe('#AABBCC');
	});
});

describe('familiesToHueDots', () => {
	it('converts families with 300 shade to HueDots', () => {
		const families = [
			{ name: 'Blue', shades: { 300: '#2F74DF' } as Record<number, string>, complete: false },
			{ name: 'Red', shades: { 300: '#D03B3B' } as Record<number, string>, complete: false }
		];
		const dots = familiesToHueDots(families);
		expect(dots).toHaveLength(2);
		expect(dots[0].name).toBe('Blue');
		expect(dots[0].source).toBe('uploaded');
		expect(dots[0].hex).toBe('#2F74DF');
		expect(dots[0].hue).toBeGreaterThan(0);
		expect(dots[1].name).toBe('Red');
	});

	it('falls back to lower shades if 300 is missing', () => {
		const families = [
			{ name: 'Test', shades: { 200: '#AABBCC', 100: '#DDEEFF' } as Record<number, string>, complete: false }
		];
		const dots = familiesToHueDots(families);
		expect(dots).toHaveLength(1);
		expect(dots[0].hex).toBe('#AABBCC');
	});

	it('skips families with no usable shades', () => {
		const families = [
			{ name: 'Empty', shades: {} as Record<number, string>, complete: false }
		];
		const dots = familiesToHueDots(families);
		expect(dots).toHaveLength(0);
	});

	it('returns empty for empty input', () => {
		expect(familiesToHueDots([])).toEqual([]);
	});
});
