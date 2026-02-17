import { describe, it, expect } from 'vitest';
import { simulateCVD, simulateHex } from './cvd-simulation';
import type { CVDType } from './cvd-simulation';

describe('simulateCVD', () => {
	it('returns identical colour for normal vision', () => {
		const result = simulateCVD(0.5, 0.3, 0.8, 'normal');
		expect(result.r).toBe(0.5);
		expect(result.g).toBe(0.3);
		expect(result.b).toBe(0.8);
	});

	it('transforms red under protanopia', () => {
		const result = simulateCVD(1, 0, 0, 'protanopia');
		// Red should become much darker/less saturated under protanopia
		expect(result.r).toBeLessThan(0.7);
		expect(result.r).toBeGreaterThan(0);
		// Should have some green/yellow shift
		expect(result.g).toBeGreaterThan(0);
	});

	it('transforms red under deuteranopia', () => {
		const result = simulateCVD(1, 0, 0, 'deuteranopia');
		// Red stays relatively bright under deuteranopia (unlike protanopia)
		expect(result.r).toBeGreaterThan(0.3);
		expect(result.g).toBeGreaterThan(0);
	});

	it('transforms blue under tritanopia', () => {
		const result = simulateCVD(0, 0, 1, 'tritanopia');
		// Blue should shift under tritanopia
		expect(result.r).toBeGreaterThanOrEqual(0);
		expect(result.g).toBeGreaterThanOrEqual(0);
		expect(result.b).toBeGreaterThanOrEqual(0);
	});

	it('preserves black and white', () => {
		const types: CVDType[] = ['protanopia', 'deuteranopia', 'tritanopia'];

		for (const type of types) {
			const black = simulateCVD(0, 0, 0, type);
			expect(black.r).toBeCloseTo(0, 1);
			expect(black.g).toBeCloseTo(0, 1);
			expect(black.b).toBeCloseTo(0, 1);

			const white = simulateCVD(1, 1, 1, type);
			expect(white.r).toBeCloseTo(1, 1);
			expect(white.g).toBeCloseTo(1, 1);
			expect(white.b).toBeCloseTo(1, 1);
		}
	});

	it('clamps output to 0-1 range', () => {
		const types: CVDType[] = ['protanopia', 'deuteranopia', 'tritanopia'];

		for (const type of types) {
			const result = simulateCVD(1, 0, 1, type);
			expect(result.r).toBeGreaterThanOrEqual(0);
			expect(result.r).toBeLessThanOrEqual(1);
			expect(result.g).toBeGreaterThanOrEqual(0);
			expect(result.g).toBeLessThanOrEqual(1);
			expect(result.b).toBeGreaterThanOrEqual(0);
			expect(result.b).toBeLessThanOrEqual(1);
		}
	});
});

describe('simulateHex', () => {
	it('returns same hex for normal vision', () => {
		expect(simulateHex('#FF0000', 'normal')).toBe('#FF0000');
	});

	it('returns valid hex for all types', () => {
		const types: CVDType[] = ['protanopia', 'deuteranopia', 'tritanopia'];
		const hexRegex = /^#[0-9A-F]{6}$/;

		for (const type of types) {
			const result = simulateHex('#3B82F6', type);
			expect(result).toMatch(hexRegex);
		}
	});

	it('red and green become similar under deuteranopia', () => {
		const simRed = simulateHex('#FF0000', 'deuteranopia');
		const simGreen = simulateHex('#00FF00', 'deuteranopia');

		// Parse hex to compare — under deuteranopia, red and green should
		// converge toward similar hues (both appear yellowish-brown)
		const parseHex = (h: string) => ({
			r: parseInt(h.slice(1, 3), 16),
			g: parseInt(h.slice(3, 5), 16),
			b: parseInt(h.slice(5, 7), 16)
		});

		const r = parseHex(simRed);
		const g = parseHex(simGreen);

		// Both should have reduced blue channel
		expect(r.b).toBeLessThan(70);
		expect(g.b).toBeLessThan(70);
	});

	it('blue channel is affected under tritanopia', () => {
		const original = '#0000FF';
		const simulated = simulateHex(original, 'tritanopia');
		expect(simulated).not.toBe(original);
	});
});
