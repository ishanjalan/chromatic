<script lang="ts">
	import type { ShadeInfo, TextLevelGroup } from '$lib/scale';

	let { shade, compact = false }: { shade: ShadeInfo; compact?: boolean } = $props();

	let isWhiteText = $derived(shade.cardTextColor === 'white');
	let heroText = $derived(isWhiteText ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)');
	let heroSub = $derived(isWhiteText ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)');
	let heroPillBg = $derived(isWhiteText ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)');
	let heroPillText = $derived(isWhiteText ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.55)');

	let copied = $state(false);
	async function copyHex() {
		await navigator.clipboard.writeText(shade.hex);
		copied = true;
		setTimeout(() => (copied = false), 1200);
	}

	function fmt(v: number, d = 2) { return v.toFixed(d); }

	let activeGroup = $derived(shade.textGroups.find(g => g.isActive)!);
	let activeDesc = $derived(activeGroup.token === 'Grey 750' ? 'Dark text' : 'Light text');
	let visibleLevels = $derived(activeGroup.levels.filter(tl => tl.label !== 'Tertiary'));

	const wcagStyle: Record<string, string> = {
		aaa: 'background: #10b981; color: white',
		aa: 'background: #3b82f6; color: white',
		'aa-large': 'background: #f59e0b; color: white',
		fail: 'background: #ef4444; color: rgba(255,255,255,0.9)'
	};
	const wcagLbl: Record<string, string> = {
		aaa: 'AAA', aa: 'AA', 'aa-large': 'AA Lg', fail: 'Fail'
	};
	const wcagTip: Record<string, string> = {
		aaa: 'WCAG AAA — Passes at all text sizes (7:1+)',
		aa: 'WCAG AA — Passes for normal text (4.5:1+)',
		'aa-large': 'WCAG AA Large — Passes for large text only (3:1+)',
		fail: 'WCAG Fail — Does not meet minimum contrast'
	};
	const apcaStyle: Record<string, string> = {
		excellent: 'background: #10b981; color: white',
		good: 'background: #3b82f6; color: white',
		min: 'background: #f59e0b; color: white',
		poor: 'background: #ef4444; color: rgba(255,255,255,0.9)'
	};
	const apcaLbl: Record<string, string> = {
		excellent: 'Exc', good: 'Good', min: 'Min', poor: 'Poor'
	};
	const apcaTip: Record<string, string> = {
		excellent: 'APCA Excellent (Lc 75+) — meets all text size requirements including body copy',
		good: 'APCA Fluent (Lc 60+) — sufficient for body text and most content',
		min: 'APCA Sub-fluent (Lc 45+) — suitable for large text and display headings only',
		poor: 'APCA Below threshold (Lc < 45) — does not meet minimum readability for any text'
	};
</script>

<div
	class="rounded-2xl overflow-hidden h-full flex flex-col transition-all duration-200 hover:-translate-y-0.5"
	style="box-shadow: 0 4px 24px -8px {shade.hex}50, 0 0 0 1px rgba(255,255,255,0.06);"
>
	{#if compact}
		<div class="flex items-center justify-between p-3" style="background-color: {shade.hex}">
			<span class="font-display text-base font-700" style="color: {heroText}">{shade.shade}</span>
			<span class="font-mono text-[13px] font-500" style="color: {heroSub}">{shade.hex}</span>
		</div>
	{:else}
		<!-- ZONE 1 — Colour Specimen -->
		<div class="relative px-6 pt-5 pb-6" style="background-color: {shade.hex}">
			<div class="flex items-start justify-between gap-3">
				<div>
					<span class="font-display text-[32px] font-800 leading-none tracking-tight" style="color: {heroText}">
						{shade.shade}
					</span>
					<button
						class="block font-mono text-[14px] font-500 mt-1.5 cursor-pointer transition-opacity hover:opacity-70"
						style="color: {heroSub}"
						onclick={copyHex}
						title="Click to copy hex value"
					>
						{copied ? 'Copied!' : shade.hex}
					</button>
				</div>
				<span
					class="text-[10px] font-body font-600 px-2 py-0.5 rounded-md uppercase tracking-[0.05em] shrink-0 mt-1"
					style="background: {heroPillBg}; color: {heroPillText}"
					title="This shade is used as the {shade.modeLabel.toLowerCase()} fill colour"
				>
					{shade.modeLabel}
				</span>
			</div>
		</div>

		<!-- ZONE 2 — Data Readout -->
		<div class="flex-1 flex flex-col px-6 pt-4 pb-5" style="background: var(--surface-2)">
			<div class="flex items-center gap-2 mb-4">
				<span class="font-mono text-[11px] font-600 uppercase tracking-wider" style="color: var(--text-secondary)">
					{activeGroup.token}
				</span>
				<span class="font-body text-[11px]" style="color: var(--text-tertiary)">
					{activeDesc}
				</span>
				<span
					class="text-[10px] font-body font-600 px-2 py-0.5 rounded-md uppercase tracking-wider"
					style="background: rgba(255,255,255,0.08); color: var(--text-tertiary)"
					title="{activeGroup.semantic === 'Standard' ? 'Standard — the default text colour used on this shade in its intended mode' : 'Inverse — the flipped text colour, used when this shade appears in the opposite mode'}"
				>{activeGroup.semantic}</span>
			</div>

			<div class="space-y-3">
				{#each visibleLevels as tl (tl.label)}
					<div>
						<div class="flex items-center gap-2 mb-1.5">
							<div
								class="w-2 h-2 rounded-sm shrink-0"
								style="background-color: {tl.effectiveHex}"
								title="Effective text colour after alpha compositing: {tl.effectiveHex}"
							></div>
							<span class="font-body text-[13px] font-500" style="color: var(--text-primary)">{tl.label}</span>
						</div>
						<div class="flex items-center gap-3 pl-4">
							<!-- APCA: primary metric -->
							<div class="flex items-center gap-1.5">
								<span class="font-mono text-[13px] font-500 tabular-nums" style="color: var(--text-secondary)" title="APCA Lightness Contrast value: {fmt(Math.abs(tl.apcaLc), 1)} — the primary accessibility metric for this system">Lc {fmt(Math.abs(tl.apcaLc), 0)}</span>
								<span class="text-[10px] font-600 px-1.5 py-0.5 rounded font-mono whitespace-nowrap" style="{apcaStyle[tl.apcaLevel]}" title="{apcaTip[tl.apcaLevel]}">{apcaLbl[tl.apcaLevel]}</span>
							</div>
							<span class="text-[11px]" style="color: var(--text-ghost)">|</span>
							<!-- WCAG 2.x: informational -->
							<div class="flex items-center gap-1.5 opacity-60" title="WCAG 2.x contrast ratio (informational — this system uses APCA as its primary metric)">
								<span class="font-mono text-[12px] tabular-nums" style="color: var(--text-tertiary)">{fmt(tl.wcagRatio, 1)}:1</span>
								<span class="text-[10px] font-600 px-1.5 py-0.5 rounded font-mono whitespace-nowrap" style="{wcagStyle[tl.wcagLevel]}">{wcagLbl[tl.wcagLevel]}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>

			{#if shade.isAnchor || shade.wasLAdjusted || shade.wasGamutReduced}
				<div class="mt-auto pt-4 flex items-center gap-1.5">
					{#if shade.isAnchor}
						<span class="text-[10px] font-body font-600 px-2 py-0.5 rounded-md" style="background: rgba(255,255,255,0.06); color: var(--text-tertiary)" title="Anchor shade — the input colour from which all other shades are mathematically derived using Oklch perceptual colour science">Anchor</span>
					{/if}
					{#if shade.wasLAdjusted}
						<span class="text-[10px] font-body font-600 px-2 py-0.5 rounded-md" style="background: rgba(255,255,255,0.06); color: var(--text-tertiary)" title="L* normalised — your input's lightness ({fmt(shade.originalL, 3)}) was mapped to the optimal APCA target ({fmt(shade.oklch.L, 3)}). Hue and chroma are preserved.">L* normalised</span>
					{/if}
					{#if shade.wasGamutReduced}
						<span class="text-[10px] font-body font-600 px-2 py-0.5 rounded-md" style="background: rgba(249,115,22,0.10); color: rgba(249,115,22,0.8)" title="Gamut mapped — chroma was reduced from {fmt(shade.originalC, 4)} to {fmt(shade.finalC, 4)} because the target colour exceeds the sRGB colour space. This is the most saturated version that screens can accurately display.">Gamut mapped</span>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
