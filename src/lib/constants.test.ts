import { describe, it, expect } from 'vitest';
import {
	TARGET_CURVE,
	SHADE_LEVELS,
	SHADE_ACTIVE_TEXT,
	SHADE_TEXT_SEMANTIC,
	SHADE_ROLES,
	TEXT_LEVELS_GREY750,
	TEXT_LEVELS_GREY50,
	ANCHOR_REF_CHROMA,
	HK_COEFF,
	APCA_TARGET_LC,
	SHADE_HEADROOM,
	BASE_RELC,
	RELC_STEP
} from './constants';
import { oklchToRgb, apcaContrast } from './colour';

// ── TARGET_CURVE ────────────────────────────────────────────────────

describe('TARGET_CURVE', () => {
	it('has entries for all 6 shade levels', () => {
		for (const level of SHADE_LEVELS) {
			expect(TARGET_CURVE).toHaveProperty(String(level));
		}
	});

	it('L values are monotonically decreasing from shade 50 to 500', () => {
		const lValues = SHADE_LEVELS.map((s) => TARGET_CURVE[s].L);
		for (let i = 1; i < lValues.length; i++) {
			expect(lValues[i]).toBeLessThan(lValues[i - 1]);
		}
	});

	it('all L values are in valid Oklch range (0–1)', () => {
		for (const level of SHADE_LEVELS) {
			expect(TARGET_CURVE[level].L).toBeGreaterThan(0);
			expect(TARGET_CURVE[level].L).toBeLessThanOrEqual(1);
		}
	});

	it('all relC values are non-negative', () => {
		for (const level of SHADE_LEVELS) {
			expect(TARGET_CURVE[level].relC).toBeGreaterThanOrEqual(0);
		}
	});

	it('relC peaks around shade 200 (strongest chroma fill)', () => {
		const relC200 = TARGET_CURVE[200].relC;
		const relC50 = TARGET_CURVE[50].relC;
		const relC500 = TARGET_CURVE[500].relC;
		expect(relC200).toBeGreaterThan(relC50);
		expect(relC200).toBeGreaterThan(relC500);
	});

	it('shade 300 relC is 0 (sentinel — user chroma used)', () => {
		expect(TARGET_CURVE[300].relC).toBe(0);
	});

	it('ANCHOR_REF_CHROMA is a positive reference chroma', () => {
		expect(ANCHOR_REF_CHROMA).toBeGreaterThan(0.1);
		expect(ANCHOR_REF_CHROMA).toBeLessThan(0.3);
	});

	it('HK_COEFF is a small positive compensation factor', () => {
		expect(HK_COEFF).toBeGreaterThan(0);
		expect(HK_COEFF).toBeLessThan(0.1);
	});
});

// ── APCA-Derived L targets ──────────────────────────────────────────

describe('APCA-derived L targets', () => {
	it('light fills (50, 100, 200) all pass Lc >= APCA_TARGET_LC with Grey 750', () => {
		const grey750 = TEXT_LEVELS_GREY750[0];
		for (const shade of [50, 100, 200] as const) {
			const L = TARGET_CURVE[shade].L;
			const { r, g, b } = oklchToRgb(L, 0, 0);
			const lc = Math.abs(apcaContrast(grey750.r, grey750.g, grey750.b, r, g, b));
			expect(lc, `Shade ${shade} should pass Lc ${APCA_TARGET_LC}`).toBeGreaterThanOrEqual(APCA_TARGET_LC);
		}
	});

	it('dark fills (300, 400, 500) all pass Lc >= APCA_TARGET_LC with Grey 50', () => {
		const grey50 = TEXT_LEVELS_GREY50[0];
		for (const shade of [300, 400, 500] as const) {
			const L = TARGET_CURVE[shade].L;
			const { r, g, b } = oklchToRgb(L, 0, 0);
			const lc = Math.abs(apcaContrast(grey50.r, grey50.g, grey50.b, r, g, b));
			expect(lc, `Shade ${shade} should pass Lc ${APCA_TARGET_LC}`).toBeGreaterThanOrEqual(APCA_TARGET_LC);
		}
	});

	it('headroom is positive for all shades', () => {
		for (const shade of SHADE_LEVELS) {
			expect(SHADE_HEADROOM[shade]).toBeGreaterThan(0);
		}
	});

	it('derived L values land close to historically validated values', () => {
		const expected: Record<number, number> = {
			50: 0.94, 100: 0.91, 200: 0.90,
			300: 0.54, 400: 0.36, 500: 0.28,
		};
		for (const shade of SHADE_LEVELS) {
			expect(TARGET_CURVE[shade].L).toBeCloseTo(expected[shade], 1);
		}
	});
});

// ── Equal-step relC ─────────────────────────────────────────────────

describe('equal-step relC', () => {
	it('tertiary shades (50, 500) have relC = BASE_RELC', () => {
		expect(TARGET_CURVE[50].relC).toBeCloseTo(BASE_RELC, 4);
		expect(TARGET_CURVE[500].relC).toBeCloseTo(BASE_RELC, 4);
	});

	it('secondary shades (100, 400) have relC = BASE_RELC + RELC_STEP', () => {
		expect(TARGET_CURVE[100].relC).toBeCloseTo(BASE_RELC + RELC_STEP, 4);
		expect(TARGET_CURVE[400].relC).toBeCloseTo(BASE_RELC + RELC_STEP, 4);
	});

	it('primary shade (200) has relC = BASE_RELC + 2 * RELC_STEP', () => {
		expect(TARGET_CURVE[200].relC).toBeCloseTo(BASE_RELC + 2 * RELC_STEP, 4);
	});

	it('light/dark role mirrors have identical relC', () => {
		expect(TARGET_CURVE[50].relC).toBe(TARGET_CURVE[500].relC);
		expect(TARGET_CURVE[100].relC).toBe(TARGET_CURVE[400].relC);
	});
});

// ── SHADE_ACTIVE_TEXT ───────────────────────────────────────────────

describe('SHADE_ACTIVE_TEXT', () => {
	it('covers all 6 shade levels', () => {
		for (const level of SHADE_LEVELS) {
			expect(SHADE_ACTIVE_TEXT).toHaveProperty(String(level));
		}
	});

	it('values are either grey750 or grey50', () => {
		for (const level of SHADE_LEVELS) {
			expect(['grey750', 'grey50']).toContain(SHADE_ACTIVE_TEXT[level]);
		}
	});

	it('light shades (50, 100) use grey750 (dark text)', () => {
		expect(SHADE_ACTIVE_TEXT[50]).toBe('grey750');
		expect(SHADE_ACTIVE_TEXT[100]).toBe('grey750');
	});

	it('dark shades (400, 500) use grey50 (light text)', () => {
		expect(SHADE_ACTIVE_TEXT[400]).toBe('grey50');
		expect(SHADE_ACTIVE_TEXT[500]).toBe('grey50');
	});
});

// ── SHADE_TEXT_SEMANTIC ─────────────────────────────────────────────

describe('SHADE_TEXT_SEMANTIC', () => {
	it('covers all 6 shade levels', () => {
		for (const level of SHADE_LEVELS) {
			expect(SHADE_TEXT_SEMANTIC).toHaveProperty(String(level));
		}
	});

	it('values are either Standard or Inverse', () => {
		for (const level of SHADE_LEVELS) {
			expect(['Standard', 'Inverse']).toContain(SHADE_TEXT_SEMANTIC[level]);
		}
	});

	it('200 and 300 are Inverse (primary fills with flipped text)', () => {
		expect(SHADE_TEXT_SEMANTIC[200]).toBe('Inverse');
		expect(SHADE_TEXT_SEMANTIC[300]).toBe('Inverse');
	});
});

// ── SHADE_ROLES ────────────────────────────────────────────────────

describe('SHADE_ROLES', () => {
	it('covers all 6 shade levels', () => {
		for (const level of SHADE_LEVELS) {
			expect(SHADE_ROLES).toHaveProperty(String(level));
		}
	});

	it('each shade has either a light or dark role (not both)', () => {
		for (const level of SHADE_LEVELS) {
			const role = SHADE_ROLES[level];
			const hasLight = role.light !== '';
			const hasDark = role.dark !== '';
			expect(hasLight || hasDark).toBe(true);
			expect(hasLight && hasDark).toBe(false);
		}
	});
});

// ── Text Level Arrays ──────────────────────────────────────────────

describe('TEXT_LEVELS', () => {
	it('Grey750 has 3 levels (Primary, Secondary, Tertiary)', () => {
		expect(TEXT_LEVELS_GREY750).toHaveLength(3);
		expect(TEXT_LEVELS_GREY750.map((l) => l.label)).toEqual(['Primary', 'Secondary', 'Tertiary']);
	});

	it('Grey50 has 3 levels (Primary, Secondary, Tertiary)', () => {
		expect(TEXT_LEVELS_GREY50).toHaveLength(3);
		expect(TEXT_LEVELS_GREY50.map((l) => l.label)).toEqual(['Primary', 'Secondary', 'Tertiary']);
	});

	it('Primary levels have alpha = 1', () => {
		expect(TEXT_LEVELS_GREY750[0].alpha).toBe(1);
		expect(TEXT_LEVELS_GREY50[0].alpha).toBe(1);
	});

	it('Secondary and Tertiary have alpha < 1', () => {
		expect(TEXT_LEVELS_GREY750[1].alpha).toBeLessThan(1);
		expect(TEXT_LEVELS_GREY750[2].alpha).toBeLessThan(1);
		expect(TEXT_LEVELS_GREY50[1].alpha).toBeLessThan(1);
		expect(TEXT_LEVELS_GREY50[2].alpha).toBeLessThan(1);
	});
});
