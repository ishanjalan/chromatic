import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import ShadeCard from './ShadeCard.svelte';
import { generateScale } from '$lib/scale';

afterEach(cleanup);

function getTestShade(shadeLevel: number = 300) {
	const scale = generateScale('#7E42EB', 'TestPurple');
	return scale.shades.find((s) => s.shade === shadeLevel)!;
}

describe('ShadeCard', () => {
	it('renders the shade number', () => {
		const shade = getTestShade(300);
		render(ShadeCard, { props: { shade } });
		const elements = screen.getAllByText('300');
		expect(elements.length).toBeGreaterThanOrEqual(1);
	});

	it('renders the hex value', () => {
		const shade = getTestShade(300);
		render(ShadeCard, { props: { shade } });
		const elements = screen.getAllByText(shade.hex);
		expect(elements.length).toBeGreaterThanOrEqual(1);
	});

	it('renders the mode label', () => {
		const shade = getTestShade(300);
		render(ShadeCard, { props: { shade } });
		const elements = screen.getAllByText(shade.modeLabel);
		expect(elements.length).toBeGreaterThanOrEqual(1);
	});

	it('renders the active text group token', () => {
		const shade = getTestShade(300);
		render(ShadeCard, { props: { shade } });
		const activeGroup = shade.textGroups.find((g) => g.isActive)!;
		const elements = screen.getAllByText(activeGroup.token);
		expect(elements.length).toBeGreaterThanOrEqual(1);
	});

	it('renders contrast level labels', () => {
		const shade = getTestShade(300);
		render(ShadeCard, { props: { shade } });
		const primaryEls = screen.getAllByText('Primary');
		const secondaryEls = screen.getAllByText('Secondary');
		expect(primaryEls.length).toBeGreaterThanOrEqual(1);
		expect(secondaryEls.length).toBeGreaterThanOrEqual(1);
	});

	it('renders the anchor pill for shade 300', () => {
		const shade = getTestShade(300);
		render(ShadeCard, { props: { shade } });
		const elements = screen.getAllByText('Anchor');
		expect(elements.length).toBeGreaterThanOrEqual(1);
	});

	it('does not render anchor pill for non-300 shades', () => {
		const shade = getTestShade(50);
		render(ShadeCard, { props: { shade } });
		expect(screen.queryByText('Anchor')).not.toBeInTheDocument();
	});

	it('renders compact mode with shade number and hex', () => {
		const shade = getTestShade(300);
		render(ShadeCard, { props: { shade, compact: true } });
		const shadeEls = screen.getAllByText('300');
		const hexEls = screen.getAllByText(shade.hex);
		expect(shadeEls.length).toBeGreaterThanOrEqual(1);
		expect(hexEls.length).toBeGreaterThanOrEqual(1);
	});

	it('renders WCAG ratio for primary text level', () => {
		const shade = getTestShade(300);
		const activeGroup = shade.textGroups.find((g) => g.isActive)!;
		const primaryLevel = activeGroup.levels.find((l) => l.label === 'Primary')!;
		render(ShadeCard, { props: { shade } });
		const ratioText = `${primaryLevel.wcagRatio.toFixed(1)}:1`;
		const elements = screen.getAllByText(ratioText);
		expect(elements.length).toBeGreaterThanOrEqual(1);
	});

	it('renders semantic label', () => {
		const shade = getTestShade(300);
		const activeGroup = shade.textGroups.find((g) => g.isActive)!;
		render(ShadeCard, { props: { shade } });
		const elements = screen.getAllByText(activeGroup.semantic);
		expect(elements.length).toBeGreaterThanOrEqual(1);
	});

	it('has copy hex button with correct title', () => {
		const shade = getTestShade(300);
		render(ShadeCard, { props: { shade } });
		const buttons = screen.getAllByTitle('Click to copy hex value');
		expect(buttons.length).toBeGreaterThanOrEqual(1);
	});
});
