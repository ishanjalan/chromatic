import { describe, it, expect } from 'vitest';
import { analyseCoverage } from './primitive-coverage';
import type { ParsedFamily, AchromaticFamily } from './parse-tokens';
import type { SemanticParseResult } from './parse-semantic-tokens';

const families: ParsedFamily[] = [
	{
		name: 'Blue',
		shades: { 50: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#3B82F6', 400: '#1D4ED8', 500: '#1E3A5F' },
		complete: true,
		source: 'token'
	}
];

const greys: AchromaticFamily[] = [
	{
		name: 'Grey',
		shades: { '0': '#FFFFFF', '50': '#F9F9F9', '750': '#1D1D1D', '800': '#141414' },
		shadeCount: 4
	}
];

function makeSemantic(tokens: Array<{ path: string; family: string; shade: string }>): SemanticParseResult {
	return {
		label: 'Light',
		tokens: tokens.map((t) => ({
			path: t.path,
			hex: '#000000',
			primitiveRef: `Colour/${t.family}/${t.shade}`,
			family: t.family,
			shadeKey: t.shade,
			scope: 'ALL_FILLS'
		})),
		errors: []
	};
}

describe('analyseCoverage', () => {
	it('identifies used and unused primitives', () => {
		const semantic = makeSemantic([
			{ path: 'Text/primary', family: 'Grey', shade: '750' },
			{ path: 'Background/primary', family: 'Blue', shade: '300' },
		]);

		const result = analyseCoverage(families, greys, [semantic]);

		expect(result.used.length).toBe(2);
		expect(result.unused.length).toBe(8); // 6 blue + 4 grey - 2 used
		expect(result.stats.totalPrimitives).toBe(10);
		expect(result.stats.usedCount).toBe(2);
	});

	it('computes per-family coverage', () => {
		const semantic = makeSemantic([
			{ path: 'Text/primary', family: 'Grey', shade: '750' },
			{ path: 'Text/bg', family: 'Grey', shade: '0' },
		]);

		const result = analyseCoverage(families, greys, [semantic]);
		const greyFam = result.byFamily.find((f) => f.family === 'Grey')!;
		const blueFam = result.byFamily.find((f) => f.family === 'Blue')!;

		expect(greyFam.used).toBe(2);
		expect(greyFam.total).toBe(4);
		expect(greyFam.pct).toBe(50);
		expect(blueFam.used).toBe(0);
		expect(blueFam.pct).toBe(0);
	});

	it('tracks unknown references', () => {
		const semantic = makeSemantic([
			{ path: 'Text/accent', family: 'Red', shade: '500' },
		]);

		const result = analyseCoverage(families, greys, [semantic]);
		expect(result.unknownRefs).toHaveLength(1);
		expect(result.unknownRefs[0].ref).toBe('Colour/Red/500');
	});

	it('handles multiple semantic files (Light + Dark)', () => {
		const light = makeSemantic([{ path: 'Text/primary', family: 'Grey', shade: '750' }]);
		const dark: SemanticParseResult = {
			...makeSemantic([{ path: 'Text/primary', family: 'Grey', shade: '50' }]),
			label: 'Dark'
		};

		const result = analyseCoverage(families, greys, [light, dark]);
		expect(result.stats.modesAnalysed).toEqual(['Light', 'Dark']);

		const grey750 = result.used.find((p) => p.shade === '750')!;
		expect(grey750.usedIn).toHaveLength(1);
		expect(grey750.usedIn[0].mode).toBe('Light');

		const grey50 = result.used.find((p) => p.shade === '50')!;
		expect(grey50.usedIn[0].mode).toBe('Dark');
	});

	it('returns 100% when all primitives are used', () => {
		const small: ParsedFamily[] = [{ name: 'Tiny', shades: { 300: '#FF0000' }, complete: false, source: 'token' }];
		const semantic = makeSemantic([{ path: 'accent', family: 'Tiny', shade: '300' }]);

		const result = analyseCoverage(small, [], [semantic]);
		expect(result.stats.pct).toBe(100);
		expect(result.unused).toHaveLength(0);
	});

	it('returns 0% when no semantics are provided', () => {
		const result = analyseCoverage(families, greys, []);
		expect(result.stats.pct).toBe(0);
		expect(result.used).toHaveLength(0);
		expect(result.unused).toHaveLength(10);
	});

	it('sorts families by coverage ascending (least used first)', () => {
		const semantic = makeSemantic([
			{ path: 'a', family: 'Blue', shade: '300' },
			{ path: 'b', family: 'Blue', shade: '400' },
			{ path: 'c', family: 'Blue', shade: '500' },
		]);

		const result = analyseCoverage(families, greys, [semantic]);
		expect(result.byFamily[0].pct).toBeLessThanOrEqual(result.byFamily[1].pct);
	});
});
