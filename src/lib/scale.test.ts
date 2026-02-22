import { describe, it, expect } from 'vitest';
import { generateScale, toJsonTokens, toJsonTokensMultiple, wcagBadge } from './scale';

// ── Scale Generation ────────────────────────────────────────────────

describe('generateScale', () => {
	const purple = '#7E42EB';
	const scale = generateScale(purple, 'TestPurple');

	it('produces exactly 6 shades', () => {
		expect(scale.shades).toHaveLength(6);
	});

	it('shades are ordered 50, 100, 200, 300, 400, 500', () => {
		const levels = scale.shades.map((s) => s.shade);
		expect(levels).toEqual([50, 100, 200, 300, 400, 500]);
	});

	it('stores the family name', () => {
		expect(scale.name).toBe('TestPurple');
	});

	it('stores the input hex', () => {
		expect(scale.inputHex).toBe(purple);
	});

	it('hue is a valid degree (0-360)', () => {
		expect(scale.hue).toBeGreaterThanOrEqual(0);
		expect(scale.hue).toBeLessThanOrEqual(360);
	});

	it('lightness values decrease monotonically from shade 50 to 500', () => {
		for (let i = 1; i < scale.shades.length; i++) {
			expect(scale.shades[i].oklch.L).toBeLessThan(scale.shades[i - 1].oklch.L);
		}
	});

	it('all hex values are valid 7-char strings', () => {
		for (const shade of scale.shades) {
			expect(shade.hex).toMatch(/^#[0-9A-F]{6}$/);
		}
	});

	it('shade 300 is marked as anchor', () => {
		const s300 = scale.shades.find((s) => s.shade === 300);
		expect(s300?.isAnchor).toBe(true);
	});

	it('non-300 shades are not anchors', () => {
		const others = scale.shades.filter((s) => s.shade !== 300);
		for (const s of others) {
			expect(s.isAnchor).toBe(false);
		}
	});

	it('gamut headroom is between 0 and 1 for all shades', () => {
		for (const shade of scale.shades) {
			expect(shade.gamutHeadroom).toBeGreaterThanOrEqual(0);
			expect(shade.gamutHeadroom).toBeLessThanOrEqual(1);
		}
	});

	it('each shade has exactly 2 text groups', () => {
		for (const shade of scale.shades) {
			expect(shade.textGroups).toHaveLength(2);
		}
	});

	it('exactly one text group per shade is active', () => {
		for (const shade of scale.shades) {
			const activeCount = shade.textGroups.filter((g) => g.isActive).length;
			expect(activeCount).toBe(1);
		}
	});

	it('each text group has 3 levels (Primary, Secondary, Tertiary)', () => {
		for (const shade of scale.shades) {
			for (const group of shade.textGroups) {
				expect(group.levels).toHaveLength(3);
				const labels = group.levels.map((l) => l.label);
				expect(labels).toEqual(['Primary', 'Secondary', 'Tertiary']);
			}
		}
	});

	it('mode labels are set correctly', () => {
		const modeLabels = scale.shades.map((s) => s.modeLabel);
		expect(modeLabels[0]).toContain('Light');    // 50 - light tertiary
		expect(modeLabels[1]).toContain('Light');    // 100 - light secondary
		expect(modeLabels[2]).toContain('Dark');     // 200 - dark primary
		expect(modeLabels[3]).toContain('Light');    // 300 - light primary
		expect(modeLabels[4]).toContain('Dark');     // 400 - dark secondary
		expect(modeLabels[5]).toContain('Dark');     // 500 - dark tertiary
	});
});

// ── Lightness Normalisation (seed model) ────────────────────────────

describe('generateScale lightness normalisation', () => {
	it('normalises very light input to TARGET_CURVE L (with H-K)', () => {
		const scale = generateScale('#F0E0FF', 'VeryLight');
		const s300 = scale.shades.find((s) => s.shade === 300)!;
		expect(s300.wasLAdjusted).toBe(true);
		// L is TARGET_CURVE[300].L minus small H-K chroma compensation
		expect(s300.oklch.L).toBeGreaterThan(0.53);
		expect(s300.oklch.L).toBeLessThan(0.56);
	});

	it('normalises very dark input to TARGET_CURVE L (with H-K)', () => {
		const scale = generateScale('#1A0033', 'VeryDark');
		const s300 = scale.shades.find((s) => s.shade === 300)!;
		expect(s300.wasLAdjusted).toBe(true);
		expect(s300.oklch.L).toBeGreaterThan(0.53);
		expect(s300.oklch.L).toBeLessThan(0.56);
	});

	it('all shades use approximate TARGET_CURVE L regardless of input', () => {
		const scale = generateScale('#FF0000', 'Red');
		for (const shade of scale.shades) {
			expect(shade.oklch.L).toBeGreaterThan(0.1);
			expect(shade.oklch.L).toBeLessThan(0.96);
		}
	});

	it('preserves user chroma for 300 shade', () => {
		const scale = generateScale('#7E42EB', 'Purple');
		const s300 = scale.shades.find((s) => s.shade === 300)!;
		// Chroma should be from the user's input (gamut-clamped), not from TARGET_CURVE
		expect(s300.oklch.C).toBeGreaterThan(0);
	});

	it('H-K compensation lowers shade 50 L below the raw target curve L', () => {
		const green = generateScale('#2E8B57', 'Green');
		const g50 = green.shades.find((s) => s.shade === 50)!;
		expect(g50.oklch.C).toBeGreaterThan(0.01);
		expect(g50.oklch.L).toBeLessThan(0.925);
	});
});

// ── APCA Compliance ─────────────────────────────────────────────────

describe('generateScale APCA compliance', () => {
	const testHexes = [
		'#7E42EB', '#285BF3', '#007B28', '#B14B00', '#C51986',
		'#E53E3E', '#ECC94B', '#D53F8C', '#ED64A6'
	];

	it('shades 50, 100, 300, 400, 500 achieve at least Lc 75 (Excellent) for primary text', () => {
		for (const hex of testHexes) {
			const scale = generateScale(hex);
			for (const shade of scale.shades) {
				if (shade.shade === 200) continue;
				const activeGroup = shade.textGroups.find((g) => g.isActive)!;
				const primary = activeGroup.levels.find((l) => l.label === 'Primary')!;
				expect(
					Math.abs(primary.apcaLc),
					`${hex} shade ${shade.shade} primary APCA Lc=${primary.apcaLc.toFixed(1)}`
				).toBeGreaterThanOrEqual(75);
			}
		}
	});

	it('shade 200 (mid-fill) achieves at least Lc 60 (good) for primary text', () => {
		for (const hex of testHexes) {
			const scale = generateScale(hex);
			const s200 = scale.shades.find((s) => s.shade === 200)!;
			const activeGroup = s200.textGroups.find((g) => g.isActive)!;
			const primary = activeGroup.levels.find((l) => l.label === 'Primary')!;
			expect(
				Math.abs(primary.apcaLc),
				`${hex} shade 200 primary APCA Lc=${primary.apcaLc.toFixed(1)}`
			).toBeGreaterThanOrEqual(60);
		}
	});
});

// ── WCAG Badge ──────────────────────────────────────────────────────

describe('wcagBadge', () => {
	it('returns AAA for >=7 contrast', () => {
		expect(wcagBadge(8, 1).level).toBe('aaa');
	});

	it('returns AA for >=4.5 contrast', () => {
		expect(wcagBadge(5, 1).level).toBe('aa');
	});

	it('returns AA Large for >=3 contrast', () => {
		expect(wcagBadge(3.5, 1).level).toBe('aa-large');
	});

	it('returns fail for low contrast', () => {
		expect(wcagBadge(1.5, 1.2).level).toBe('fail');
	});

	it('prefers white background when both pass', () => {
		const badge = wcagBadge(8, 8);
		expect(badge.background).toBe('white');
	});

	it('returns AAA on black when white is below 7', () => {
		const badge = wcagBadge(4.0, 8.0);
		expect(badge.level).toBe('aaa');
		expect(badge.background).toBe('black');
	});

	it('returns AA on black when white is below 4.5', () => {
		const badge = wcagBadge(2.5, 5.0);
		expect(badge.level).toBe('aa');
		expect(badge.background).toBe('black');
	});

	it('returns AA Large on black when white is below 3', () => {
		const badge = wcagBadge(1.5, 3.5);
		expect(badge.level).toBe('aa-large');
		expect(badge.background).toBe('black');
	});
});

// ── JSON Token Export ───────────────────────────────────────────────

describe('toJsonTokens', () => {
	const scale = generateScale('#3B82F6', 'Blue');
	const json = toJsonTokens(scale) as Record<string, unknown>;

	it('has Colour top-level key', () => {
		expect(json).toHaveProperty('Colour');
	});

	it('has family name under Colour', () => {
		const colour = json['Colour'] as Record<string, unknown>;
		expect(colour).toHaveProperty('Blue');
	});

	it('has all 6 shade entries', () => {
		const colour = json['Colour'] as Record<string, Record<string, unknown>>;
		const family = colour['Blue'];
		expect(Object.keys(family)).toHaveLength(6);
		expect(Object.keys(family).sort()).toEqual(['100', '200', '300', '400', '50', '500']);
	});

	it('each shade has $type, $value, $extensions', () => {
		const colour = json['Colour'] as Record<string, Record<string, Record<string, unknown>>>;
		const family = colour['Blue'];
		for (const shadeKey of Object.keys(family)) {
			const shade = family[shadeKey];
			expect(shade).toHaveProperty('$type', 'color');
			expect(shade).toHaveProperty('$value');
			expect(shade).toHaveProperty('$extensions');

			const val = shade['$value'] as Record<string, unknown>;
			expect(val).toHaveProperty('colorSpace', 'srgb');
			expect(val).toHaveProperty('components');
			expect(val).toHaveProperty('alpha', 1);
			expect(val).toHaveProperty('hex');
		}
	});
});

describe('achromatic / neutral grey input', () => {
	const greyScale = generateScale('#808080', 'Grey');

	it('detects the input as achromatic', () => {
		expect(greyScale.isAchromatic).toBe(true);
	});

	it('produces 6 shades with near-zero chroma', () => {
		expect(greyScale.shades).toHaveLength(6);
		for (const shade of greyScale.shades) {
			expect(shade.oklch.C).toBeLessThan(0.001);
		}
	});

	it('all shade hex values are visually neutral (R ≈ G ≈ B)', () => {
		for (const shade of greyScale.shades) {
			const maxDiff = Math.max(
				Math.abs(shade.rgb.r - shade.rgb.g),
				Math.abs(shade.rgb.g - shade.rgb.b),
				Math.abs(shade.rgb.r - shade.rgb.b)
			);
			expect(maxDiff).toBeLessThan(0.02);
		}
	});

	it('chromatic input is NOT detected as achromatic', () => {
		const blueScale = generateScale('#3B82F6', 'Blue');
		expect(blueScale.isAchromatic).toBe(false);
	});

	it('near-white is detected as achromatic', () => {
		const whiteScale = generateScale('#F5F5F5', 'OffWhite');
		expect(whiteScale.isAchromatic).toBe(true);
		for (const shade of whiteScale.shades) {
			expect(shade.oklch.C).toBeLessThan(0.001);
		}
	});

	it('near-black is detected as achromatic', () => {
		const blackScale = generateScale('#1A1A1A', 'OffBlack');
		expect(blackScale.isAchromatic).toBe(true);
		for (const shade of blackScale.shades) {
			expect(shade.oklch.C).toBeLessThan(0.001);
		}
	});

	it('gamut headroom is valid for achromatic input', () => {
		const greyScale = generateScale('#808080', 'Grey');
		for (const shade of greyScale.shades) {
			expect(shade.gamutHeadroom).toBeGreaterThanOrEqual(0);
			expect(shade.gamutHeadroom).toBeLessThanOrEqual(1);
		}
	});
});

// ── CAM16 Hue Correction ────────────────────────────────────────────

describe('CAM16 hue correction', () => {
	it('non-anchor shades have hue adjusted from the raw input hue', () => {
		const scale = generateScale('#3B82F6', 'Blue');
		const inputHue = scale.hue;
		for (const shade of scale.shades) {
			if (shade.isAnchor) continue;
			const hueDiff = Math.abs(shade.oklch.H - inputHue);
			const wrapped = hueDiff > 180 ? 360 - hueDiff : hueDiff;
			expect(wrapped).toBeLessThan(30);
		}
	});

	it('achromatic inputs bypass hue correction (no drift)', () => {
		const scale = generateScale('#808080', 'Grey');
		for (const shade of scale.shades) {
			expect(shade.oklch.C).toBeLessThan(0.001);
		}
	});

	it('blue hue drifts toward higher angles at light shades', () => {
		const scale = generateScale('#3B6FD0', 'Blue');
		const s50 = scale.shades.find((s) => s.shade === 50)!;
		const s500 = scale.shades.find((s) => s.shade === 500)!;
		expect(s50.oklch.H).toBeGreaterThan(s500.oklch.H);
	});

	it('yellow shade 50 hue drift stays tight (Abney effect is weak)', () => {
		const scale = generateScale('#EAB308', 'Yellow');
		const inputHue = scale.hue;
		const s50 = scale.shades.find((s) => s.shade === 50)!;
		let drift = s50.oklch.H - inputHue;
		if (drift > 180) drift -= 360;
		if (drift < -180) drift += 360;
		expect(Math.abs(drift)).toBeLessThan(12);
	});

	it('all shades stay within 30 deg of anchor hue (integration check)', () => {
		const testHexes = ['#3B82F6', '#2E8B57', '#EAB308', '#E53E3E', '#7E42EB'];
		for (const hex of testHexes) {
			const scale = generateScale(hex);
			const inputHue = scale.hue;
			for (const shade of scale.shades) {
				let diff = shade.oklch.H - inputHue;
				if (diff > 180) diff -= 360;
				if (diff < -180) diff += 360;
				expect(
					Math.abs(diff),
					`${hex} shade ${shade.shade} drift=${diff.toFixed(1)}`
				).toBeLessThan(30);
			}
		}
	});
});

// ── Gamut Normalisation ─────────────────────────────────────────────

describe('gamut-width normalisation', () => {
	it('wide-gamut hues (green) have restrained chroma at shade 50', () => {
		const green = generateScale('#2E8B57', 'Green');
		const blue = generateScale('#3B6FD0', 'Blue');
		const g50 = green.shades.find((s) => s.shade === 50)!;
		const b50 = blue.shades.find((s) => s.shade === 50)!;
		expect(g50.oklch.C / b50.oklch.C).toBeLessThan(3);
	});

	it('yellow shade 50 chroma is within Tailwind reference range', () => {
		const yellow = generateScale('#EAB308', 'Yellow');
		const y50 = yellow.shades.find((s) => s.shade === 50)!;
		expect(y50.oklch.C).toBeLessThan(0.080);
	});

	it('green shade 100 chroma is restrained for wide-gamut hues', () => {
		const green = generateScale('#2E8B57', 'Green');
		const blue = generateScale('#3B6FD0', 'Blue');
		const g100 = green.shades.find((s) => s.shade === 100)!;
		const b100 = blue.shades.find((s) => s.shade === 100)!;
		expect(g100.oklch.C / b100.oklch.C).toBeLessThan(4);
	});

	it('shade 200 chroma is unaffected by damping ceiling (L below threshold)', () => {
		const green = generateScale('#2E8B57', 'Green');
		const g200 = green.shades.find((s) => s.shade === 200)!;
		expect(g200.oklch.C).toBeGreaterThan(0.05);
	});

	it('shade 300 preserves user chroma unmodified', () => {
		const scale = generateScale('#E53E3E', 'Red');
		const s300 = scale.shades.find((s) => s.shade === 300)!;
		expect(s300.oklch.C).toBeGreaterThan(0.1);
	});

	it('dark fills (400, 500) have meaningful chroma', () => {
		const scale = generateScale('#3B82F6', 'Blue');
		const s400 = scale.shades.find((s) => s.shade === 400)!;
		const s500 = scale.shades.find((s) => s.shade === 500)!;
		expect(s400.oklch.C).toBeGreaterThan(0.05);
		expect(s500.oklch.C).toBeGreaterThan(0.03);
	});
});

describe('toJsonTokensMultiple', () => {
	const s1 = generateScale('#3B82F6', 'Blue');
	const s2 = generateScale('#10B981', 'Green');
	const json = toJsonTokensMultiple([s1, s2]) as Record<string, unknown>;

	it('has Colour top-level key', () => {
		expect(json).toHaveProperty('Colour');
	});

	it('has both family names', () => {
		const colour = json['Colour'] as Record<string, unknown>;
		expect(colour).toHaveProperty('Blue');
		expect(colour).toHaveProperty('Green');
	});

	it('each family has 6 shades', () => {
		const colour = json['Colour'] as Record<string, Record<string, unknown>>;
		expect(Object.keys(colour['Blue'])).toHaveLength(6);
		expect(Object.keys(colour['Green'])).toHaveLength(6);
	});
});
