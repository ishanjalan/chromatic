import { describe, it, expect } from 'vitest';
import {
	TARGET_CURVE,
	SHADE_LEVELS,
	SHADE_ACTIVE_TEXT,
	SHADE_TEXT_SEMANTIC,
	SHADE_ROLES,
	TEXT_LEVELS_GREY750,
	TEXT_LEVELS_GREY50
} from './constants';

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

	it('all C values are non-negative', () => {
		for (const level of SHADE_LEVELS) {
			expect(TARGET_CURVE[level].C).toBeGreaterThanOrEqual(0);
		}
	});

	it('C peaks around 300 shade (highest chroma at anchor)', () => {
		const C300 = TARGET_CURVE[300].C;
		const C50 = TARGET_CURVE[50].C;
		const C500 = TARGET_CURVE[500].C;
		expect(C300).toBeGreaterThan(C50);
		expect(C300).toBeGreaterThan(C500);
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
