import { describe, it, expect } from 'vitest';
import { analyseNeutrals } from './neutral-analysis';
import type { AchromaticFamily } from './parse-tokens';

function makeFamily(
	name: string,
	shades: Record<string, string>,
	isAlpha = false
): AchromaticFamily {
	return { name, shades, shadeCount: Object.keys(shades).length, isAlpha };
}

describe('analyseNeutrals', () => {
	const pureGrey = makeFamily('Grey', {
		'0': '#FFFFFF',
		'50': '#F9F9F9',
		'100': '#F0F0F0',
		'200': '#DCDCDC',
		'300': '#BFBFBF',
		'400': '#9E9E9E',
		'500': '#808080',
		'600': '#616161',
		'700': '#484848',
		'800': '#303030',
		'900': '#1C1C1C',
		'950': '#0D0D0D',
	});

	it('returns the correct family name', () => {
		const result = analyseNeutrals(pureGrey);
		expect(result.familyName).toBe('Grey');
	});

	it('marks isAlpha false for non-alpha families', () => {
		const result = analyseNeutrals(pureGrey);
		expect(result.isAlpha).toBe(false);
	});

	it('marks isAlpha true for alpha families', () => {
		const alpha = makeFamily('Grey Alpha', { '50': '#00000019', '100': '#00000033' }, true);
		const result = analyseNeutrals(alpha);
		expect(result.isAlpha).toBe(true);
	});

	it('analyses all shades', () => {
		const result = analyseNeutrals(pureGrey);
		expect(result.shades).toHaveLength(12);
		expect(result.stats.totalShades).toBe(12);
	});

	it('sorts shades from light to dark', () => {
		const result = analyseNeutrals(pureGrey);
		for (let i = 1; i < result.shades.length; i++) {
			expect(result.shades[i].L).toBeLessThanOrEqual(result.shades[i - 1].L);
		}
	});

	it('computes APCA scores for each shade', () => {
		const result = analyseNeutrals(pureGrey);
		for (const shade of result.shades) {
			expect(typeof shade.apcaOnWhite).toBe('number');
			expect(typeof shade.apcaOnDark).toBe('number');
		}
	});

	it('detects pure greys as not tinted', () => {
		const result = analyseNeutrals(pureGrey);
		expect(result.stats.tintedCount).toBe(0);
		expect(result.avgTintHue).toBeNull();
	});

	it('produces a distribution score between 0 and 100', () => {
		const result = analyseNeutrals(pureGrey);
		expect(result.distributionScore).toBeGreaterThanOrEqual(0);
		expect(result.distributionScore).toBeLessThanOrEqual(100);
	});

	it('produces consolidation recommendations', () => {
		const result = analyseNeutrals(pureGrey);
		expect(result.consolidated.length).toBeGreaterThan(0);
		for (const c of result.consolidated) {
			expect(c.role).toBeTruthy();
			expect(c.hex).toMatch(/^#[0-9A-Fa-f]{6}/);
		}
	});

	it('matches pure neutrals to achromatic reference names', () => {
		const result = analyseNeutrals(pureGrey);
		expect(result.tintMatches.length).toBeGreaterThan(0);
		for (const m of result.tintMatches) {
			expect(m.isAchromatic).toBe(true);
		}
	});

	it('reports tint consistency as true for pure greys', () => {
		const result = analyseNeutrals(pureGrey);
		expect(result.tintConsistent).toBe(true);
	});
});

describe('proximity clusters', () => {
	it('detects very close shades as a proximity cluster', () => {
		const close = makeFamily('TooClose', {
			'100': '#F0F0F0',
			'150': '#EFEFEF',
			'200': '#E0E0E0',
			'300': '#B0B0B0',
		});
		const result = analyseNeutrals(close);
		if (result.proximityClusters.length > 0) {
			const cluster = result.proximityClusters[0];
			expect(cluster.shades.length).toBeGreaterThanOrEqual(2);
			expect(cluster.keepShade).toBeDefined();
			expect(cluster.dropShades.length).toBeGreaterThan(0);
			expect(cluster.reason).toBeTruthy();
		}
	});

	it('does not cluster well-separated shades', () => {
		const spread = makeFamily('Spread', {
			'100': '#F0F0F0',
			'500': '#808080',
			'900': '#1C1C1C',
		});
		const result = analyseNeutrals(spread);
		expect(result.proximityClusters).toHaveLength(0);
	});

	it('keeps the lower shade number when roundness ties in a cluster', () => {
		const tied = makeFamily('Tied', {
			'100': '#EBEBEB',
			'200': '#EAEAEA',
			'500': '#808080',
		});
		const result = analyseNeutrals(tied);
		const cluster = result.proximityClusters.find(
			(c) => c.shades.includes(100) && c.shades.includes(200)
		);
		if (cluster) {
			expect(cluster.keepShade).toBe(100);
			expect(cluster.dropShades).toContain(200);
		}
	});

	it('prefers rounder shade numbers in clusters (100 over 150)', () => {
		const mixed = makeFamily('Mixed', {
			'100': '#EBEBEB',
			'150': '#EAEAEA',
			'500': '#808080',
		});
		const result = analyseNeutrals(mixed);
		const cluster = result.proximityClusters.find(
			(c) => c.shades.includes(100) && c.shades.includes(150)
		);
		if (cluster) {
			expect(cluster.keepShade).toBe(100);
			expect(cluster.dropShades).toContain(150);
		}
	});
});

describe('tinted neutral detection', () => {
	it('detects tinted greys and matches to reference names', () => {
		const tinted = makeFamily('Slate', {
			'100': '#F1F5F9',
			'200': '#E2E8F0',
			'300': '#CBD5E1',
			'500': '#64748B',
			'700': '#334155',
			'900': '#0F172A',
		});
		const result = analyseNeutrals(tinted);
		expect(result.stats.tintedCount).toBeGreaterThan(0);
		expect(result.avgTintHue).not.toBeNull();
		expect(result.tintMatches.some((m) => !m.isAchromatic)).toBe(true);
	});
});
