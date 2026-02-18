import { describe, it, expect } from 'vitest';
import { parseTokenJson, familiesToHueDots, detectTokenType } from './parse-tokens';

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

/* ─── Achromatic / Neutral family detection ─── */

const makeGreyShades = (shadeKeys: string[]) => {
	const entries: Record<string, object> = {};
	for (const key of shadeKeys) {
		const v = Math.round(255 * (1 - Number(key) / 1000));
		const hex = `#${v.toString(16).padStart(2, '0').repeat(3).toUpperCase()}`;
		entries[key] = { $type: 'color', $value: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 1, hex } };
	}
	return entries;
};

describe('achromatic family detection', () => {
	it('detects pure grey families as achromatic', () => {
		const json = JSON.stringify({
			Colour: {
				Grey: makeGreyShades(['0', '50', '100', '200', '300', '400', '500', '600', '700', '800'])
			}
		});
		const result = parseTokenJson(json);
		expect(result.families).toHaveLength(0);
		expect(result.achromaticFamilies).toHaveLength(1);
		expect(result.achromaticFamilies[0].name).toBe('Grey');
		expect(result.achromaticFamilies[0].isAlpha).toBeFalsy();
	});

	it('imports all shade keys for achromatic families (not just core 6)', () => {
		const shadeKeys = ['0', '50', '70', '100', '150', '200', '300', '350', '400', '500', '600', '650', '670', '680', '700', '750', '760', '800'];
		const json = JSON.stringify({ Colour: { Grey: makeGreyShades(shadeKeys) } });
		const result = parseTokenJson(json);
		expect(result.achromaticFamilies[0].shadeCount).toBe(shadeKeys.length);
	});
});

/* ─── Alpha / opacity family parsing ─── */

describe('alpha family parsing', () => {
	it('parses top-level alpha families', () => {
		const entries: Record<string, object> = {};
		for (const key of ['50', '100', '200', '300', '400', '500']) {
			const alpha = Math.round(255 * Number(key) / 500).toString(16).padStart(2, '0');
			entries[key] = { $type: 'color', $value: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 1, hex: `#000000${alpha}` } };
		}
		const json = JSON.stringify({ Colour: { 'Grey Alpha': entries } });
		const result = parseTokenJson(json);
		expect(result.achromaticFamilies.length).toBeGreaterThanOrEqual(1);
		const alphaFam = result.achromaticFamilies.find((f) => f.name === 'Grey Alpha');
		expect(alphaFam).toBeDefined();
		expect(alphaFam!.isAlpha).toBe(true);
	});

	it('parses nested alpha sub-families (e.g. Grey/Alpha)', () => {
		const greyShades = makeGreyShades(['0', '50', '100', '200', '300', '400', '500', '600', '700', '800']);

		const alphaEntries: Record<string, object> = {};
		for (const key of ['50', '100', '200', '300', '400', '500']) {
			const alpha = Math.round(255 * Number(key) / 500).toString(16).padStart(2, '0');
			alphaEntries[key] = { $type: 'color', $value: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 1, hex: `#000000${alpha}` } };
		}

		const json = JSON.stringify({
			Colour: {
				Grey: {
					...greyShades,
					Alpha: alphaEntries
				}
			}
		});
		const result = parseTokenJson(json);

		// Should find both Grey (achromatic) and Grey Alpha (alpha)
		expect(result.achromaticFamilies.length).toBe(2);
		const greyFam = result.achromaticFamilies.find((f) => f.name === 'Grey');
		const alphaFam = result.achromaticFamilies.find((f) => f.name === 'Grey Alpha');

		expect(greyFam).toBeDefined();
		expect(greyFam!.isAlpha).toBeFalsy();

		expect(alphaFam).toBeDefined();
		expect(alphaFam!.isAlpha).toBe(true);
		expect(alphaFam!.shadeCount).toBe(6);
	});

	it('accepts 8-digit hex values (RRGGBBAA)', () => {
		const entries: Record<string, object> = {};
		entries['100'] = { $type: 'color', $value: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 1, hex: '#1A1A1A33' } };
		entries['200'] = { $type: 'color', $value: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 1, hex: '#1A1A1A66' } };
		entries['300'] = { $type: 'color', $value: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 1, hex: '#1A1A1A99' } };

		const json = JSON.stringify({ Colour: { 'GreyAlpha': entries } });
		const result = parseTokenJson(json);
		const alphaFam = result.achromaticFamilies.find((f) => f.name === 'GreyAlpha');
		expect(alphaFam).toBeDefined();
		expect(alphaFam!.isAlpha).toBe(true);
		expect(alphaFam!.shadeCount).toBe(3);
		expect(alphaFam!.shades[100]).toBe('#1A1A1A33');
	});

	it('does not duplicate parent family shades into nested sub-family', () => {
		const greyShades = makeGreyShades(['0', '50', '100', '200', '300']);
		const alphaEntries: Record<string, object> = {
			'50': { $type: 'color', $value: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 1, hex: '#00000019' } },
			'100': { $type: 'color', $value: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 1, hex: '#00000033' } }
		};

		const json = JSON.stringify({ Colour: { Grey: { ...greyShades, Alpha: alphaEntries } } });
		const result = parseTokenJson(json);

		const greyFam = result.achromaticFamilies.find((f) => f.name === 'Grey');
		const alphaFam = result.achromaticFamilies.find((f) => f.name === 'Grey Alpha');

		expect(greyFam!.shadeCount).toBe(5);
		expect(alphaFam!.shadeCount).toBe(2);
	});
});

/* ─── detectTokenType ─── */

describe('detectTokenType', () => {
	it('returns "primitive" for standard token JSON', () => {
		const json = JSON.stringify(makeFamilyJson('Red', FULL_SHADES));
		expect(detectTokenType(json)).toBe('primitive');
	});

	it('returns "semantic" for JSON with aliasData', () => {
		const json = JSON.stringify({
			Text: {
				primary: {
					$type: 'color',
					$value: { hex: '#1D1D1D' },
					$extensions: {
						'com.figma.aliasData': {
							targetVariableName: 'Colour/Grey/750'
						}
					}
				}
			}
		});
		expect(detectTokenType(json)).toBe('semantic');
	});

	it('returns "invalid" for non-JSON', () => {
		expect(detectTokenType('not json')).toBe('invalid');
	});
});
