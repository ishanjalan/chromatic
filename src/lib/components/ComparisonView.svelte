<script lang="ts">
	import { generateScale } from '$lib/scale';
	import type { ScaleResult } from '$lib/scale';
	import { hexToRgb, rgbToOklch, apcaContrast, alphaComposite, relativeLuminance } from '$lib/colour';
	import { SHADE_LEVELS, SHADE_ACTIVE_TEXT } from '$lib/constants';
	import { findClosestMulti } from '$lib/colour-match';
	import type { ParsedFamily } from '$lib/parse-tokens';
	import type { PaletteAudit, ChromaAnalysis, Shade300Tweak, ScoreBreakdown } from '$lib/palette-audit';
	import GradientStrip from './GradientStrip.svelte';
	import EngineCurves from './EngineCurves.svelte';

	let {
		families,
		audit = null,
		onSelectFamily,
		lockedFamilies = new Set<string>(),
		onToggleLock,
		onRemoveFamily,
		onAcceptProposed
	}: {
		families: ParsedFamily[];
		audit?: PaletteAudit | null;
		onSelectFamily?: (hex: string, name: string) => void;
		lockedFamilies?: Set<string>;
		onToggleLock?: (familyName: string) => void;
		onRemoveFamily?: (familyName: string) => void;
		onAcceptProposed?: (familyName: string) => void;
	} = $props();

	// Track which swatch was just copied (unique key: row-family-shade)
	let copiedKey = $state('');

	// Filter bar state
	let activeFilter = $state<'all' | 'changed' | 'failing' | 'adjusted'>('all');

	// Collapsible families
	let expandedFamilies = $state<Set<string>>(new Set());
	let allExpanded = $state(false);

	function toggleFamily(name: string) {
		const next = new Set(expandedFamilies);
		if (next.has(name)) next.delete(name);
		else next.add(name);
		expandedFamilies = next;
	}
	function toggleAllExpanded() {
		if (allExpanded) {
			expandedFamilies = new Set();
			allExpanded = false;
		} else {
			expandedFamilies = new Set(filteredComparisons.map((c) => c.name));
			allExpanded = true;
		}
	}

	// Score breakdown popover
	let showBreakdown = $state(false);

	function breakdownLabel(key: keyof ScoreBreakdown): string {
		const labels: Record<keyof ScoreBreakdown, string> = {
			proximity: 'Hue collisions',
			chromaImbalance: 'Saturation imbalance',
			lightnessTweaks: 'Lightness adjustments',
			hueGaps: 'Hue coverage gaps',
			coverageUniformity: 'Distribution evenness',
			warmCoolBalance: 'Warm/cool balance',
			familyCountAdj: 'Family count'
		};
		return labels[key];
	}

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
	const G50 = { r: 1.0, g: 1.0, b: 1.0 };

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
		source: 'token' | 'workspace';
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
			const isWorkspace = fam.source === 'workspace';
			const tweakEntry = tweakMap.get(fam.name);

			// When locked or workspace-sourced: use the ORIGINAL hex as-is.
			// Workspace families were just added — no "original" to improve.
			// When unlocked token family: use the audit's suggested anchor if available.
			const proposedAnchor = (isLocked || isWorkspace)
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
				source: fam.source ?? 'token',
			});
		}

		return results;
	});

	let totalExistingFails = $derived(comparisons.reduce((a, c) => a + c.existingApcaFails, 0));
	let totalProposedFails = $derived(comparisons.reduce((a, c) => a + c.proposedApcaFails, 0));
	let totalShades = $derived(comparisons.length * 6);
	let unchangedShades = $derived(comparisons.reduce((a, c) => a + c.shades.filter((s) => s.delta255 === 0).length, 0));

	let filteredComparisons = $derived.by(() => {
		if (activeFilter === 'all') return comparisons;
		return comparisons.filter((c) => {
			if (activeFilter === 'changed') return c.maxDelta > 0;
			if (activeFilter === 'failing') return c.existingApcaFails > 0 || c.proposedApcaFails > 0;
			if (activeFilter === 'adjusted') return c.tweak !== null && !c.isLocked;
			return true;
		});
	});
</script>

{#if comparisons.length > 0}
<div class="space-y-5">
	<!-- Summary bar -->
	<div
		class="flex flex-wrap gap-4 items-center px-5 py-4 rounded-2xl"
		style="background: var(--surface-2); border: 1px solid var(--border-subtle)"
	>
		<!-- Audit score with breakdown popover -->
		{#if audit}
			{@const sc = audit.score}
			{@const scColor = sc >= 85 ? '#10b981' : sc >= 65 ? '#f59e0b' : '#ef4444'}
			{@const scLabel = sc >= 85 ? 'Excellent' : sc >= 65 ? 'Needs Attention' : 'Critical'}
			<div class="relative flex items-center gap-2.5">
				<button
					class="w-10 h-10 rounded-xl flex items-center justify-center font-display text-[16px] font-700 cursor-pointer transition-all hover:ring-2 hover:ring-white/10"
					style="background: {scColor}20; color: {scColor}"
					title="Click to see score breakdown"
					onclick={() => { showBreakdown = !showBreakdown; }}
				>
					{sc}
				</button>
				<div>
					<p class="font-display text-[13px] font-600" style="color: {scColor}">{scLabel}</p>
					<button
						class="font-body text-[11px] cursor-pointer hover:underline"
						style="color: var(--text-tertiary)"
						onclick={() => { showBreakdown = !showBreakdown; }}
					>
						{showBreakdown ? 'Hide breakdown' : 'See breakdown'}
					</button>
				</div>
				<!-- Score breakdown popover -->
				{#if showBreakdown && audit}
					{@const bd = audit.scoreBreakdown}
					{@const entries = [
						['proximity', bd.proximity],
						['chromaImbalance', bd.chromaImbalance],
						['lightnessTweaks', bd.lightnessTweaks],
						['hueGaps', bd.hueGaps],
						['coverageUniformity', bd.coverageUniformity],
						['warmCoolBalance', bd.warmCoolBalance],
						['familyCountAdj', bd.familyCountAdj]
					] as [keyof ScoreBreakdown, number][]}
					{@const maxDeduction = Math.min(...entries.map(([, v]) => v))}
					<div
						class="absolute left-0 top-full mt-2 z-50 w-72 rounded-xl p-4 space-y-1.5 shadow-lg fade-in"
						style="background: var(--surface-1); border: 1px solid var(--border-medium)"
					>
						<p class="font-display text-[12px] font-600 mb-2" style="color: var(--text-secondary)">
							Score: {sc} / 100
						</p>
						{#each entries as [key, value]}
							<div class="flex items-center justify-between gap-2">
								<span class="font-body text-[11px]" style="color: var(--text-tertiary)">
									{breakdownLabel(key)}
								</span>
								<span
									class="font-mono text-[11px] font-600"
									style="color: {value === 0 ? '#10b981' : value === maxDeduction ? '#ef4444' : '#f59e0b'}"
								>
									{value > 0 ? '+' : ''}{value} pts
								</span>
							</div>
						{/each}
					</div>
				{/if}
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
			title="Readability failures — shades that don't meet the minimum APCA Lc 60 threshold for their intended text pairing. Left = existing, right = proposed."
		>
			<span class="font-body text-[13px]" style="color: var(--text-secondary)">Readability:</span>
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

	<!-- Filter bar -->
	<div class="flex flex-wrap items-center gap-2">
		{#each [
			{ key: 'all', label: 'All' },
			{ key: 'changed', label: 'Changed only' },
			{ key: 'failing', label: 'Readability failures' },
			{ key: 'adjusted', label: 'Adjustments' }
		] as filter}
			<button
				class="text-[11px] font-body font-500 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
				style="background: {activeFilter === filter.key ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.03)'}; color: {activeFilter === filter.key ? 'var(--text-primary)' : 'var(--text-tertiary)'}; border: 1px solid {activeFilter === filter.key ? 'var(--border-medium)' : 'transparent'}"
				onclick={() => { activeFilter = filter.key as typeof activeFilter; }}
			>
				{filter.label}
				{#if filter.key === 'failing'}
					({totalExistingFails + totalProposedFails})
				{/if}
			</button>
		{/each}
		<div class="flex-1"></div>
		<button
			class="text-[11px] font-body font-500 px-2.5 py-1 rounded-md cursor-pointer transition-all hover:opacity-70"
			style="color: var(--text-tertiary)"
			onclick={toggleAllExpanded}
		>
			{allExpanded ? 'Collapse all' : 'Expand all'}
		</button>
	</div>

	<!-- Per-family comparison -->
	{#each filteredComparisons as comp (comp.name)}
		{@const matches = findClosestMulti(comp.existing300Hex)}
		{@const proposedAnchor = (comp.isLocked || comp.source === 'workspace') ? comp.existing300Hex : (comp.tweak ? comp.tweak.suggestedHex : comp.existing300Hex)}
		<div
			class="rounded-2xl overflow-hidden"
			style="background: var(--surface-1); border: 1px solid {comp.isLocked ? 'rgba(234,179,8,0.25)' : 'var(--border-subtle)'}"
		>
			<!-- Family header (clickable to expand/collapse) -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="flex items-center justify-between px-5 py-3 cursor-pointer transition-colors hover:bg-white/[0.02]"
				style="border-bottom: 1px solid var(--border-subtle)"
				onclick={() => toggleFamily(comp.name)}
			>
				<div class="flex items-center gap-3 flex-wrap">
					<svg
						viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
						class="transition-transform duration-200 shrink-0"
						style="color: var(--text-ghost); transform: rotate({expandedFamilies.has(comp.name) ? '90' : '0'}deg)"
					>
						<path d="M6 4l4 4-4 4" />
					</svg>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="w-5 h-5 rounded-md ring-1 ring-white/10 cursor-pointer transition-all hover:ring-2 hover:ring-white/30 hover:scale-110"
						style="background-color: {comp.existing300Hex}"
						title="Load {comp.name} ({comp.existing300Hex}) into the generator"
						onclick={(e) => { e.stopPropagation(); onSelectFamily?.(comp.existing300Hex, comp.name); }}
					></div>
					<span
						class="font-display text-[15px] font-600"
						style="color: var(--text-primary)"
					>{comp.name}</span>
					<span class="font-mono text-[12px]" style="color: var(--text-tertiary)">
						{comp.existing300Hex}
					</span>
					{#if comp.source === 'workspace'}
						<span
							class="text-[10px] font-body font-600 px-2 py-0.5 rounded-md"
							style="background: rgba(139,92,246,0.12); color: rgba(167,139,250,0.9)"
						>
							Manually added
						</span>
						{#if onRemoveFamily}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<span
								class="text-[10px] font-body font-500 px-1.5 py-0.5 rounded-md cursor-pointer transition-all hover:opacity-80"
								style="background: rgba(239,68,68,0.08); color: rgba(239,68,68,0.7)"
								title="Remove {comp.name} from the workspace"
								onclick={(e) => { e.stopPropagation(); onRemoveFamily(comp.name); }}
							>✕</span>
						{/if}
					{/if}
					{#if onToggleLock}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<span
							class="inline-flex items-center gap-1 text-[10px] font-body font-600 px-2 py-0.5 rounded-md cursor-pointer transition-all hover:opacity-80"
							style="background: {comp.isLocked ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.04)'}; color: {comp.isLocked ? 'rgba(234,179,8,0.9)' : 'var(--text-ghost)'}"
							title="{comp.isLocked ? 'Locked — the 300 shade is preserved as-is. Click to unlock.' : 'Click to lock the 300 shade.'}"
							onclick={(e) => { e.stopPropagation(); onToggleLock(comp.name); }}
						>
							{comp.isLocked ? '🔒' : '🔓'} 300 {comp.isLocked ? 'locked' : 'unlocked'}
						</span>
					{/if}
				{#if !matches.isAchromatic}
					{#each [
						{ m: matches.tailwind, label: 'TW', full: 'Tailwind CSS v4' },
						{ m: matches.spectrum, label: 'SP', full: 'Adobe Spectrum 2' },
						{ m: matches.radix,    label: 'RX', full: 'Radix Colors' }
					] as entry}
						{#if entry.m && entry.m.confidence !== 'distant'}
							{@const isHueFar = entry.m.hueDelta > 15}
							<span
								class="text-[10px] font-mono font-600 px-2 py-0.5 rounded-md inline-flex items-center gap-1"
								style="background: {isHueFar ? 'rgba(249,115,22,0.10)' : 'rgba(255,255,255,0.04)'}; color: {isHueFar ? 'rgba(249,115,22,0.85)' : 'var(--text-ghost)'}"
								title="Closest {entry.full}: {entry.m.name} (Δ{entry.m.hueDelta.toFixed(0)}° hue){isHueFar ? ' — hue is >15° away' : ''}"
							>
								<span class="w-2 h-2 rounded-sm ring-1 ring-white/10" style="background-color: {entry.m.previewHex}"></span>
								{entry.label} {entry.m.name}
							</span>
						{/if}
					{/each}
				{/if}

					{#if comp.chroma?.flagged}
						{@const ca = comp.chroma}
						{@const devPct = Math.abs(ca.deviation * 100).toFixed(0)}
						<span
							class="text-[10px] font-mono font-600 px-2 py-0.5 rounded-md"
							style="background: {ca.deviation > 0 ? 'rgba(249,115,22,0.10)' : 'rgba(56,189,248,0.10)'}; color: {ca.deviation > 0 ? 'rgba(249,115,22,0.85)' : 'rgba(56,189,248,0.85)'}"
							title="Saturation: {ca.deviation > 0 ? '+' : ''}{devPct}% {ca.deviation > 0 ? 'above' : 'below'} median. This family may appear {ca.deviation > 0 ? 'more vivid' : 'more muted'} than its peers."
						>
							Saturation: {ca.deviation > 0 ? '+' : '−'}{devPct}%
						</span>
					{/if}
				</div>
				<div class="flex items-center gap-2 shrink-0">
					{#if comp.source === 'workspace'}
						{#if comp.existingApcaFails === 0}
							<span class="text-[10px] font-body font-600 px-2 py-0.5 rounded-md" style="background: rgba(16,185,129,0.10); color: #10b981">
								Readable
							</span>
						{:else}
							<span class="text-[10px] font-body font-600 px-2 py-0.5 rounded-md" style="background: rgba(239,68,68,0.10); color: #ef4444">
								{comp.existingApcaFails} readability {comp.existingApcaFails === 1 ? 'fail' : 'fails'}
							</span>
						{/if}
					{:else}
						{#if comp.maxDelta === 0}
							<span class="text-[10px] font-body font-600 px-2 py-0.5 rounded-md" style="background: rgba(16,185,129,0.10); color: #10b981">
								No changes
							</span>
						{:else}
							{@const dColor = comp.maxDelta > 40 ? '#ef4444' : comp.maxDelta > 20 ? '#f59e0b' : 'var(--text-tertiary)'}
							<span
								class="text-[10px] font-mono font-600 px-2 py-0.5 rounded-md"
								style="background: {comp.maxDelta > 40 ? 'rgba(239,68,68,0.10)' : comp.maxDelta > 20 ? 'rgba(245,158,11,0.10)' : 'rgba(255,255,255,0.04)'}; color: {dColor}"
							>
								max Δ{comp.maxDelta}
							</span>
						{/if}
						{#if comp.existingApcaFails > 0 && comp.proposedApcaFails === 0}
							<span
								class="text-[10px] font-body font-600 px-2 py-0.5 rounded-md"
								style="background: rgba(16,185,129,0.10); color: #10b981"
								title="All readability failures in this family are resolved by the proposed values"
							>
								Readability resolved
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
							>
								Adjustment skipped
							</span>
						{/if}
						{#if onAcceptProposed && comp.tweak && !comp.isLocked && comp.source === 'token'}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<span
								class="text-[10px] font-body font-600 px-2 py-0.5 rounded-md cursor-pointer transition-all hover:opacity-80"
								style="background: rgba(16,185,129,0.12); color: #10b981"
								title="Accept the proposed anchor and add this family to the workspace"
								onclick={(e) => { e.stopPropagation(); onAcceptProposed(comp.name); }}
							>
								Accept proposed
							</span>
						{/if}
					{/if}
				</div>
			</div>

			<!-- Shade strips (collapsible) -->
			{#if expandedFamilies.has(comp.name)}
			<div class="px-5 py-4">
				{#if comp.source === 'workspace'}
					<!-- Single-row layout for workspace families (no existing vs proposed) -->
					<div class="grid gap-x-2 gap-y-1.5" style="grid-template-columns: 72px repeat(6, 1fr)">
						<!-- Shade number header row -->
						<div></div>
						{#each comp.shades as sc (sc.shade)}
							<span class="block font-mono text-[11px] font-600 text-center" style="color: var(--text-secondary)">{sc.shade}</span>
						{/each}

						<!-- Single scale row -->
						<div class="flex flex-col justify-center gap-0.5">
							<span class="font-body text-[11px] font-500" style="color: var(--text-tertiary)">Generated</span>
							{#if onSelectFamily}
								<button
									class="font-body text-[10px] font-500 cursor-pointer transition-opacity hover:opacity-70 text-left"
									style="color: var(--text-ghost)"
									title="Load {comp.name} ({comp.existing300Hex}) into the generator"
									onclick={() => onSelectFamily?.(comp.existing300Hex, comp.name)}
								>Edit →</button>
							{/if}
						</div>
						{#each comp.shades as sc (sc.shade)}
							{@const key = `w-${comp.name}-${sc.shade}`}
							<button
								class="relative h-12 rounded-lg ring-1 ring-white/5 flex items-center justify-center cursor-pointer transition-all hover:ring-2 hover:ring-white/20 active:scale-[0.97]"
								style="background-color: {sc.existingHex}"
								title="Click to copy {sc.existingHex} | APCA Lc {sc.existingApcaLc.toFixed(0)}"
								onclick={() => copyHex(sc.existingHex, key)}
							>
								<span
									class="font-mono text-[9px] font-500 transition-opacity"
									style="color: {swatchTextColor(sc.existingHex)}"
								>{copiedKey === key ? 'Copied!' : sc.existingHex}</span>
							</button>
						{/each}
					</div>

					<!-- Single gradient strip -->
					<div class="mt-3 px-1">
						<GradientStrip hexes={comp.shades.map((s) => s.existingHex)} height={10} />
					</div>
				{:else}
					<!-- Two-row layout for token families (existing vs proposed) -->
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

					<!-- Gradient strips: existing vs proposed -->
					<div class="mt-3 flex flex-col gap-1.5 px-1">
						<GradientStrip hexes={comp.shades.map((s) => s.existingHex)} label="Existing" height={10} />
						<GradientStrip hexes={comp.shades.map((s) => s.proposedHex)} label="Proposed" height={10} />
					</div>

					<!-- Lightness & Chroma comparison curves -->
					<div class="mt-4 px-1">
						<EngineCurves
							shades={comp.shades.map((s) => ({ shade: s.shade, existingHex: s.existingHex, proposedHex: s.proposedHex }))}
							familyName={comp.name}
						/>
					</div>
				{/if}
			</div>
			{/if}
			<!-- end collapsible shade strips -->

		</div>
	{/each}
</div>
{/if}
