<script lang="ts">
	import { generateScale } from '$lib/scale';
	import type { ScaleResult } from '$lib/scale';
	import { hexToRgb, rgbToOklch, apcaContrast, alphaComposite, relativeLuminance } from '$lib/colour';
	import { SHADE_LEVELS, SHADE_ACTIVE_TEXT } from '$lib/constants';
	import { findClosestTailwind } from '$lib/tailwind-match';
	import type { ParsedFamily } from '$lib/parse-tokens';
	import type { PaletteAudit, ChromaAnalysis, Shade300Tweak } from '$lib/palette-audit';

	let {
		families,
		audit = null,
		onSelectFamily,
		lockedFamilies = new Set<string>(),
		onToggleLock
	}: {
		families: ParsedFamily[];
		audit?: PaletteAudit | null;
		onSelectFamily?: (hex: string, name: string) => void;
		lockedFamilies?: Set<string>;
		onToggleLock?: (familyName: string) => void;
	} = $props();

	// Track which swatch was just copied (unique key: row-family-shade)
	let copiedKey = $state('');

	function swatchTextColor(hex: string): string {
		const { r, g, b } = hexToRgb(hex);
		const lum = relativeLuminance(r, g, b);
		return lum > 0.18 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)';
	}

	async function copyHex(hex: string, key: string) {
		try {
			await navigator.clipboard.writeText(hex);
			copiedKey = key;
			setTimeout(() => { copiedKey = ''; }, 1200);
		} catch {
			// Fallback: noop
		}
	}

	// Text tokens for APCA checks
	const G750 = { r: 0.1137, g: 0.1137, b: 0.1137 };
	const G50 = { r: 0.9922, g: 0.9922, b: 0.9922 };

	interface ShadeComparison {
		shade: number;
		existingHex: string;
		proposedHex: string;
		delta255: number;
		existingApcaLc: number;
		proposedApcaLc: number;
		existingApcaPass: boolean;
		proposedApcaPass: boolean;
	}

	interface FamilyComparison {
		name: string;
		existing300Hex: string;
		shades: ShadeComparison[];
		maxDelta: number;
		existingApcaFails: number;
		proposedApcaFails: number;
		proposedScale: ScaleResult;
		chroma: ChromaAnalysis | null;
		tweak: Shade300Tweak | null;
		isLocked: boolean;
	}

	function computeApcaPrimary(hex: string, shade: number): { lc: number; pass: boolean } {
		const { r, g, b } = hexToRgb(hex);
		const textToken = SHADE_ACTIVE_TEXT[shade] === 'grey750' ? G750 : G50;
		const eff = alphaComposite(textToken.r, textToken.g, textToken.b, 1.0, r, g, b);
		const lc = Math.abs(apcaContrast(eff.r, eff.g, eff.b, r, g, b));
		return { lc, pass: lc >= 60 };
	}

	// Keyed cache — avoids re-generating scales for the same hex:name pair
	const scaleCache = new Map<string, ScaleResult>();
	function cachedGenerateScale(hex: string, name: string): ScaleResult {
		const key = `${hex}:${name}`;
		if (!scaleCache.has(key)) scaleCache.set(key, generateScale(hex, name));
		return scaleCache.get(key)!;
	}

	// Build chroma/tweak lookup maps from audit
	let chromaMap = $derived.by(() => {
		if (!audit) return new Map<string, ChromaAnalysis>();
		const m = new Map<string, ChromaAnalysis>();
		for (const ca of audit.chromaAnalysis) m.set(ca.family, ca);
		return m;
	});

	let tweakMap = $derived.by(() => {
		if (!audit) return new Map<string, Shade300Tweak>();
		const m = new Map<string, Shade300Tweak>();
		for (const tw of audit.shade300Tweaks) m.set(tw.family, tw);
		return m;
	});

	let comparisons = $derived.by(() => {
		const results: FamilyComparison[] = [];

		for (const fam of families) {
			if (!fam.complete || !fam.shades[300]) continue;

			const isLocked = lockedFamilies.has(fam.name);
			const tweakEntry = tweakMap.get(fam.name);

			// When locked: use the ORIGINAL hex so 300 stays exactly as-is.
			// When unlocked: use the audit's suggested anchor if available.
			const proposedAnchor = isLocked
				? fam.shades[300]
				: (tweakEntry ? tweakEntry.suggestedHex : fam.shades[300]);
			const proposedScale = cachedGenerateScale(proposedAnchor, fam.name);

			// When locked, override the 300 shade with the exact original hex.
			// The generator normalises L to TARGET_CURVE, but the user wants
			// their precise original — so we swap in the original values.
			let proposedShades = proposedScale.shades;
			if (isLocked) {
				proposedShades = proposedScale.shades.map((s) => {
					if (s.shade !== 300) return s;
					// Reconstruct 300 from the original hex
					const { r, g, b } = hexToRgb(fam.shades[300]);
					const oklch = rgbToOklch(r, g, b);
					return { ...s, hex: fam.shades[300], rgb: { r, g, b }, oklch: { L: oklch.L, C: oklch.C, H: oklch.H } };
				});
			}

			const shades: ShadeComparison[] = [];
			let maxDelta = 0;
			let existingFails = 0;
			let proposedFails = 0;

			for (const level of SHADE_LEVELS) {
				const existingHex = fam.shades[level];
				const proposedShade = proposedShades.find((s) => s.shade === level)!;
				const proposedHex = isLocked && level === 300 ? fam.shades[300] : proposedShade.hex;

				const eRgb = hexToRgb(existingHex);
				const pRgb = hexToRgb(proposedHex);
				const delta = Math.max(
					Math.abs(eRgb.r - pRgb.r),
					Math.abs(eRgb.g - pRgb.g),
					Math.abs(eRgb.b - pRgb.b)
				);
				const delta255 = Math.round(delta * 255);
				maxDelta = Math.max(maxDelta, delta255);

				const existingApca = computeApcaPrimary(existingHex, level);
				const proposedApca = computeApcaPrimary(proposedHex, level);
				if (!existingApca.pass) existingFails++;
				if (!proposedApca.pass) proposedFails++;

				shades.push({
					shade: level,
					existingHex,
					proposedHex,
					delta255,
					existingApcaLc: existingApca.lc,
					proposedApcaLc: proposedApca.lc,
					existingApcaPass: existingApca.pass,
					proposedApcaPass: proposedApca.pass,
				});
			}

			results.push({
				name: fam.name,
				existing300Hex: fam.shades[300],
				shades,
				maxDelta,
				existingApcaFails: existingFails,
				proposedApcaFails: proposedFails,
				proposedScale,
				chroma: chromaMap.get(fam.name) ?? null,
				tweak: tweakMap.get(fam.name) ?? null,
				isLocked,
			});
		}

		return results;
	});

	let totalExistingFails = $derived(comparisons.reduce((a, c) => a + c.existingApcaFails, 0));
	let totalProposedFails = $derived(comparisons.reduce((a, c) => a + c.proposedApcaFails, 0));
	let totalShades = $derived(comparisons.length * 6);
	let unchangedShades = $derived(comparisons.reduce((a, c) => a + c.shades.filter((s) => s.delta255 === 0).length, 0));
</script>

{#if comparisons.length > 0}
<div class="space-y-5">
	<!-- Summary bar -->
	<div
		class="flex flex-wrap gap-4 items-center px-5 py-4 rounded-2xl"
		style="background: var(--surface-2); border: 1px solid var(--border-subtle)"
	>
		<!-- Audit score (if available) -->
		{#if audit}
			{@const sc = audit.score}
			{@const scColor = sc >= 85 ? '#10b981' : sc >= 65 ? '#f59e0b' : '#ef4444'}
			{@const scLabel = sc >= 85 ? 'Excellent' : sc >= 65 ? 'Needs Attention' : 'Critical'}
			<div class="flex items-center gap-2.5">
				<div
					class="w-10 h-10 rounded-xl flex items-center justify-center font-display text-[16px] font-700"
					style="background: {scColor}20; color: {scColor}"
					title="Palette audit score — composite of chroma balance, hue distribution, and contrast compliance"
				>
					{sc}
				</div>
				<div>
					<p class="font-display text-[13px] font-600" style="color: {scColor}">{scLabel}</p>
					<p class="font-body text-[11px]" style="color: var(--text-tertiary)">Audit Score</p>
				</div>
			</div>
			<div class="w-px h-8" style="background: var(--border-medium)"></div>
		{/if}

		<div class="flex items-baseline gap-2">
			<span class="font-display text-[18px] font-700" style="color: var(--text-primary)">{comparisons.length}</span>
			<span class="font-body text-[13px]" style="color: var(--text-secondary)">
				{comparisons.length === 1 ? 'family' : 'families'}
			</span>
		</div>
		<div class="w-px h-5" style="background: var(--border-medium)"></div>
		<div class="flex items-baseline gap-2">
			<span class="font-mono text-[14px] font-600" style="color: var(--text-primary)">{unchangedShades}/{totalShades}</span>
			<span class="font-body text-[13px]" style="color: var(--text-secondary)">unchanged</span>
		</div>
		<div class="w-px h-5" style="background: var(--border-medium)"></div>
		<div
			class="flex items-baseline gap-2"
			title="APCA contrast failures — shades that don't meet the minimum Lc 60 readability threshold for their intended text pairing. Left = existing, right = proposed."
		>
			<span class="font-body text-[13px]" style="color: var(--text-secondary)">APCA:</span>
			<span
				class="font-mono text-[14px] font-600"
				style="color: {totalExistingFails > 0 ? '#ef4444' : '#10b981'}"
			>{totalExistingFails}</span>
			<span class="font-body text-[12px]" style="color: var(--text-ghost)">→</span>
			<span
				class="font-mono text-[14px] font-600"
				style="color: {totalProposedFails > 0 ? '#ef4444' : '#10b981'}"
			>{totalProposedFails}</span>
			<span class="font-body text-[12px]" style="color: var(--text-tertiary)">fails</span>
		</div>

		{#if audit && audit.shade300Tweaks.length > 0}
			<div class="w-px h-5" style="background: var(--border-medium)"></div>
			<div class="flex items-baseline gap-2">
				<span class="font-display text-[16px] font-700" style="color: var(--text-primary)">{audit.shade300Tweaks.length}</span>
				<span class="font-body text-[13px]" style="color: var(--text-secondary)">{audit.shade300Tweaks.length === 1 ? 'adjustment' : 'adjustments'}</span>
			</div>
		{/if}

		{#if audit && audit.gapSuggestions.length > 0}
			<div class="w-px h-5" style="background: var(--border-medium)"></div>
			<div class="flex items-baseline gap-2">
				<span class="font-display text-[16px] font-700" style="color: var(--text-primary)">{audit.gapSuggestions.length}</span>
				<span class="font-body text-[13px]" style="color: var(--text-secondary)">suggested</span>
			</div>
		{/if}

		<div class="flex-1"></div>
		<div class="flex items-center gap-3">
			<span class="font-body text-[11px]" style="color: var(--text-ghost)" title="Per-channel RGB difference between existing and proposed shades. Under 10 = minor, 10–20 = noticeable, 20–40 = significant, 40+ = major.">Δ = colour delta</span>
		</div>
	</div>

	<!-- Per-family comparison -->
	{#each comparisons as comp (comp.name)}
		{@const twMatch = findClosestTailwind(comp.existing300Hex)}
		{@const isTwMismatch = twMatch.name.toLowerCase() !== comp.name.toLowerCase()}
		{@const proposedAnchor = comp.isLocked ? comp.existing300Hex : (comp.tweak ? comp.tweak.suggestedHex : comp.existing300Hex)}
		<div
			class="rounded-2xl overflow-hidden"
			style="background: var(--surface-1); border: 1px solid {comp.isLocked ? 'rgba(234,179,8,0.25)' : 'var(--border-subtle)'}"
		>
			<!-- Family header -->
			<div class="flex items-center justify-between px-5 py-3" style="border-bottom: 1px solid var(--border-subtle)">
				<div class="flex items-center gap-3">
					<button
						class="w-5 h-5 rounded-md ring-1 ring-white/10 cursor-pointer transition-all hover:ring-2 hover:ring-white/30 hover:scale-110"
						style="background-color: {comp.existing300Hex}"
						title="Load {comp.name} ({comp.existing300Hex}) into the generator"
						onclick={() => onSelectFamily?.(comp.existing300Hex, comp.name)}
					></button>
					<button
						class="font-display text-[15px] font-600 cursor-pointer transition-colors hover:opacity-70"
						style="color: var(--text-primary)"
						title="Load {comp.name} into the generator"
						onclick={() => onSelectFamily?.(comp.existing300Hex, comp.name)}
					>{comp.name}</button>
					<span class="font-mono text-[12px]" style="color: var(--text-tertiary)">
						{comp.existing300Hex}
					</span>
					<!-- Lock 300 toggle -->
					{#if onToggleLock}
						<button
							class="inline-flex items-center gap-1 text-[10px] font-body font-600 px-2 py-0.5 rounded-md cursor-pointer transition-all hover:opacity-80"
							style="background: {comp.isLocked ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.04)'}; color: {comp.isLocked ? 'rgba(234,179,8,0.9)' : 'var(--text-ghost)'}"
							title="{comp.isLocked ? 'Locked — the 300 shade is preserved as-is. Other shades still use optimised values. Click to unlock.' : 'Click to lock the 300 shade — preserves your exact hex while still optimising other shades.'}"
							onclick={() => onToggleLock(comp.name)}
						>
							{comp.isLocked ? '🔒' : '🔓'} 300 {comp.isLocked ? 'locked' : 'unlocked'}
						</button>
					{/if}
					{#if isTwMismatch && twMatch.confidence !== 'distant'}
						<span
							class="text-[10px] font-mono font-600 px-2 py-0.5 rounded-md"
							style="background: rgba(249,115,22,0.10); color: rgba(249,115,22,0.85)"
							title="This is named '{comp.name}' but is closest to Tailwind's '{twMatch.name}' (Δ{twMatch.hueDelta.toFixed(0)}° hue)"
						>
							≈ TW {twMatch.name}
						</span>
					{:else}
						<span
							class="text-[10px] font-mono font-600 px-2 py-0.5 rounded-md"
							style="background: rgba(255,255,255,0.04); color: var(--text-ghost)"
							title="Matches Tailwind's '{twMatch.name}' (Δ{twMatch.hueDelta.toFixed(0)}° hue)"
						>
							TW {twMatch.name}
						</span>
					{/if}

					<!-- Inline chroma badge -->
					{#if comp.chroma?.flagged}
						{@const ca = comp.chroma}
						{@const devPct = Math.abs(ca.deviation * 100).toFixed(0)}
						<span
							class="text-[10px] font-mono font-600 px-2 py-0.5 rounded-md"
							style="background: {ca.deviation > 0 ? 'rgba(249,115,22,0.10)' : 'rgba(56,189,248,0.10)'}; color: {ca.deviation > 0 ? 'rgba(249,115,22,0.85)' : 'rgba(56,189,248,0.85)'}"
							title="{ca.deviation > 0 ? 'Oversaturated' : 'Undersaturated'} — this family's chroma is {devPct}% {ca.deviation > 0 ? 'above' : 'below'} the palette median. Gamut usage: {(ca.relativeChroma * 100).toFixed(0)}% (median: {(ca.targetRelChroma * 100).toFixed(0)}%)."
						>
							{ca.deviation > 0 ? 'Oversaturated' : 'Undersaturated'} ({ca.deviation > 0 ? '+' : '−'}{devPct}%)
						</span>
					{/if}
				</div>
				<div class="flex items-center gap-3">
					{#if comp.maxDelta === 0}
						<span class="text-[10px] font-body font-600 px-2 py-0.5 rounded-md" style="background: rgba(16,185,129,0.10); color: #10b981">
							No changes
						</span>
					{:else}
						{@const dColor = comp.maxDelta > 40 ? '#ef4444' : comp.maxDelta > 20 ? '#f59e0b' : 'var(--text-tertiary)'}
						<span
							class="text-[10px] font-mono font-600 px-2 py-0.5 rounded-md"
							style="background: {comp.maxDelta > 40 ? 'rgba(239,68,68,0.10)' : comp.maxDelta > 20 ? 'rgba(245,158,11,0.10)' : 'rgba(255,255,255,0.04)'}; color: {dColor}"
							title="Maximum per-channel colour difference (0–255). Under 10 = minor, 10–20 = noticeable, 20–40 = significant, 40+ = major."
						>
							max Δ{comp.maxDelta}
						</span>
					{/if}
					{#if comp.existingApcaFails > 0 && comp.proposedApcaFails === 0}
						<span
							class="text-[10px] font-body font-600 px-2 py-0.5 rounded-md"
							style="background: rgba(16,185,129,0.10); color: #10b981"
							title="All APCA contrast failures in this family are resolved by the proposed values"
						>
							APCA resolved
						</span>
					{/if}
					{#if comp.tweak && !comp.isLocked}
						<span
							class="text-[10px] font-body font-600 px-2 py-0.5 rounded-md"
							style="background: rgba(234,179,8,0.10); color: rgba(234,179,8,0.85)"
							title="300 anchor: {comp.tweak.currentHex} → {comp.tweak.suggestedHex}. {comp.tweak.reasons.join(' ')}"
						>
							Anchor adjusted
						</span>
					{:else if comp.tweak && comp.isLocked}
						<span
							class="text-[10px] font-body font-600 px-2 py-0.5 rounded-md"
							style="background: rgba(234,179,8,0.06); color: rgba(234,179,8,0.5)"
							title="Adjustment available ({comp.tweak.currentHex} → {comp.tweak.suggestedHex}) but 300 is locked. {comp.tweak.reasons.join(' ')}"
						>
							Adjustment skipped
						</span>
					{/if}
				</div>
			</div>

			<!-- Shade strips -->
			<div class="px-5 py-4">
				<!-- Row-oriented grid: label column + 6 shade columns -->
				<div class="grid gap-x-2 gap-y-1.5" style="grid-template-columns: 72px repeat(6, 1fr)">
					<!-- Shade number header row -->
					<div></div>
					{#each comp.shades as sc (sc.shade)}
						<span class="block font-mono text-[11px] font-600 text-center" style="color: var(--text-secondary)">{sc.shade}</span>
					{/each}

					<!-- Existing row label + CTA -->
					<div class="flex flex-col justify-center gap-0.5">
						<span class="font-body text-[11px] font-500" style="color: var(--text-tertiary)">Existing</span>
						{#if onSelectFamily}
							<button
								class="font-body text-[10px] font-500 cursor-pointer transition-opacity hover:opacity-70 text-left"
								style="color: var(--text-ghost)"
								title="Load the original 300 shade ({comp.existing300Hex}) into the generator"
								onclick={() => onSelectFamily?.(comp.existing300Hex, comp.name)}
							>Edit →</button>
						{/if}
					</div>
					{#each comp.shades as sc (sc.shade)}
						{@const eKey = `e-${comp.name}-${sc.shade}`}
						<button
							class="relative h-12 rounded-lg ring-1 ring-white/5 flex items-center justify-center cursor-pointer transition-all hover:ring-2 hover:ring-white/20 active:scale-[0.97]"
							style="background-color: {sc.existingHex}"
							title="Click to copy {sc.existingHex} | APCA Lc {sc.existingApcaLc.toFixed(0)}"
							onclick={() => copyHex(sc.existingHex, eKey)}
						>
							<span
								class="font-mono text-[9px] font-500 transition-opacity"
								style="color: {swatchTextColor(sc.existingHex)}"
							>{copiedKey === eKey ? 'Copied!' : sc.existingHex}</span>
						</button>
					{/each}

					<!-- Proposed row label + CTA -->
					<div class="flex flex-col justify-center gap-0.5">
						<span
							class="font-body text-[11px] font-500"
							style="color: var(--text-tertiary)"
							title="{comp.isLocked ? '300 shade is locked to ' + comp.existing300Hex + ' — other shades are still optimised' : comp.tweak ? 'Generated from the adjusted 300 anchor (' + comp.tweak.suggestedHex + ')' : 'Generated from the existing 300 anchor'}"
						>{comp.isLocked ? 'Proposed ⁽³⁰⁰ locked⁾' : 'Proposed'}</span>
						{#if onSelectFamily}
							<button
								class="font-body text-[10px] font-500 cursor-pointer transition-opacity hover:opacity-70 text-left"
								style="color: var(--text-ghost)"
								title="Load the proposed 300 shade ({proposedAnchor}) into the generator"
								onclick={() => onSelectFamily?.(proposedAnchor, comp.name)}
							>Edit →</button>
						{/if}
					</div>
					{#each comp.shades as sc (sc.shade)}
						{@const pKey = `p-${comp.name}-${sc.shade}`}
						{@const is300Locked = comp.isLocked && sc.shade === 300}
						<button
							class="relative h-12 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:ring-2 hover:ring-white/20 active:scale-[0.97]"
							class:ring-2={is300Locked}
							class:ring-1={!is300Locked}
							style="background-color: {sc.proposedHex}; {is300Locked ? 'ring-color: rgba(234,179,8,0.5); --tw-ring-color: rgba(234,179,8,0.5)' : '--tw-ring-color: rgba(255,255,255,0.05)'}"
							title="{is300Locked ? '🔒 Locked — ' : ''}Click to copy {sc.proposedHex} | APCA Lc {sc.proposedApcaLc.toFixed(0)}"
							onclick={() => copyHex(sc.proposedHex, pKey)}
						>
							<span
								class="font-mono text-[9px] font-500 transition-opacity"
								style="color: {swatchTextColor(sc.proposedHex)}"
							>{copiedKey === pKey ? 'Copied!' : sc.proposedHex}</span>
						</button>
					{/each}

					<!-- Delta row -->
					<div></div>
					{#each comp.shades as sc (sc.shade)}
						<div class="text-center">
							{#if sc.delta255 === 0}
								<span class="block font-mono text-[10px]" style="color: var(--text-ghost)">—</span>
							{:else}
								<span
									class="block font-mono text-[10px] font-500"
									style="color: {sc.delta255 > 40 ? '#ef4444' : sc.delta255 > 20 ? '#f59e0b' : 'var(--text-tertiary)'}"
									title="Δ{sc.delta255} — {sc.delta255 < 10 ? 'minor' : sc.delta255 < 20 ? 'noticeable' : sc.delta255 < 40 ? 'significant' : 'major'} difference"
								>
									Δ{sc.delta255}
								</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>

		</div>
	{/each}
</div>
{/if}
