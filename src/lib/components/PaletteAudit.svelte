<script lang="ts">
	import type { PaletteAudit } from '$lib/palette-audit';
	import type { GapSuggestion } from '$lib/gap-analysis';
	import { MAX_PALETTE_SIZE } from '$lib/constants';

	let {
		audit,
		onSelectFamily,
		onAddToWorkspace
	}: {
		audit: PaletteAudit;
		onSelectFamily?: (hex: string, name: string) => void;
		onAddToWorkspace?: (hex: string, name: string, source?: string) => void;
	} = $props();

	let capacityPct = $derived(Math.round((audit.familyCount / MAX_PALETTE_SIZE) * 100));
	let capacityColor = $derived(
		capacityPct >= 100
			? '#ef4444'
			: capacityPct >= 80
				? '#f59e0b'
				: 'rgba(74, 222, 128, 0.85)'
	);

	// Tier thresholds
	const TIER_STRONG = 0.65;
	const TIER_GOOD = 0.45;

	interface Tier {
		label: string;
		sublabel: string;
		items: GapSuggestion[];
		accent: string;
		accentBg: string;
	}

	let tiers = $derived.by<Tier[]>(() => {
		const strong: GapSuggestion[] = [];
		const good: GapSuggestion[] = [];
		const optional: GapSuggestion[] = [];

		for (const s of audit.gapSuggestions) {
			if (s.score >= TIER_STRONG) strong.push(s);
			else if (s.score >= TIER_GOOD) good.push(s);
			else optional.push(s);
		}

		const result: Tier[] = [];
		if (strong.length > 0) result.push({
			label: 'Strongly recommended',
			sublabel: 'High-confidence additions that improve hue coverage, chroma balance, and warm/cool distribution',
			items: strong,
			accent: 'rgba(74, 222, 128, 0.85)',
			accentBg: 'rgba(74, 222, 128, 0.06)'
		});
		if (good.length > 0) result.push({
			label: 'Worth considering',
			sublabel: 'Solid options with one or two weaker signals — review before adding',
			items: good,
			accent: 'rgba(56, 189, 248, 0.85)',
			accentBg: 'rgba(56, 189, 248, 0.06)'
		});
		if (optional.length > 0) result.push({
			label: 'Optional',
			sublabel: 'Low-priority fills — may introduce chroma mismatch or overlap',
			items: optional,
			accent: 'var(--text-ghost)',
			accentBg: 'rgba(255, 255, 255, 0.02)'
		});
		return result;
	});

	function severityColor(severity: 'critical' | 'warning' | 'info'): string {
		if (severity === 'critical') return '#ef4444';
		if (severity === 'warning') return '#f59e0b';
		return 'var(--text-tertiary)';
	}

	function severityBg(severity: 'critical' | 'warning' | 'info'): string {
		if (severity === 'critical') return 'rgba(239, 68, 68, 0.08)';
		if (severity === 'warning') return 'rgba(245, 158, 11, 0.08)';
		return 'rgba(255, 255, 255, 0.03)';
	}

	function sourceBadgeStyle(source: string): { bg: string; color: string } {
		if (source === 'Tailwind') return { bg: 'rgba(56, 189, 248, 0.10)', color: 'rgba(56, 189, 248, 0.85)' };
		if (source === 'Spectrum') return { bg: 'rgba(168, 85, 247, 0.10)', color: 'rgba(168, 85, 247, 0.85)' };
		if (source === 'Radix')    return { bg: 'rgba(74, 222, 128, 0.10)', color: 'rgba(74, 222, 128, 0.85)' };
		return { bg: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-tertiary)' };
	}

	function signalColor(value: number): string {
		if (value >= 0.7) return 'rgba(74, 222, 128, 0.85)';
		if (value >= 0.4) return 'rgba(245, 158, 11, 0.75)';
		return 'rgba(255, 255, 255, 0.15)';
	}

	function signalLabel(value: number): string {
		if (value >= 0.7) return 'Strong';
		if (value >= 0.4) return 'Fair';
		return 'Weak';
	}

	function handleAddAllRecommended() {
		if (!onAddToWorkspace) return;
		const strong = audit.gapSuggestions.filter((s) => s.score >= TIER_STRONG);
		for (const s of strong) {
			onAddToWorkspace(s.hex, s.name, s.source);
		}
	}

	function globalRank(sug: GapSuggestion): number {
		return audit.gapSuggestions.indexOf(sug) + 1;
	}
</script>

<div class="space-y-5">

	<!-- Hue Collisions -->
	{#if audit.proximityWarnings.length > 0}
		<div
			class="rounded-2xl overflow-hidden"
			style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
		>
			<div class="px-5 py-3.5" style="border-bottom: 1px solid var(--border-subtle)">
				<p class="font-display text-[13px] font-600" style="color: var(--text-primary)">
					Hue Collisions
				</p>
				<p class="font-body text-[11px] mt-0.5" style="color: var(--text-tertiary)">
					Colour families whose hue angles are too close to visually distinguish
				</p>
			</div>

			<div class="px-5 py-4 space-y-3">
				{#each audit.proximityWarnings as pw (pw.familyA + pw.familyB)}
					{@const hexA = audit.chromaAnalysis.find(c => c.family === pw.familyA)?.hex300 ?? '#888'}
					{@const hexB = audit.chromaAnalysis.find(c => c.family === pw.familyB)?.hex300 ?? '#888'}
					<div
						class="flex items-start gap-4 px-4 py-3.5 rounded-xl"
						style="background: {severityBg(pw.severity)}; border: 1px solid {severityColor(pw.severity)}20"
					>
						<div class="flex items-center gap-1 shrink-0 mt-0.5">
							<div class="w-5 h-5 rounded-md ring-1 ring-white/10" style="background-color: {hexA}"></div>
							<div class="w-2 text-center font-mono text-[10px]" style="color: var(--text-ghost)">↔</div>
							<div class="w-5 h-5 rounded-md ring-1 ring-white/10" style="background-color: {hexB}"></div>
						</div>

						<div class="flex-1">
							<div class="flex items-center gap-2 flex-wrap">
								<span class="font-display text-[13px] font-600" style="color: var(--text-primary)">
									{pw.familyA} + {pw.familyB}
								</span>
								<span
									class="text-[10px] font-mono font-600 px-2 py-0.5 rounded-md"
									style="background: {severityColor(pw.severity)}15; color: {severityColor(pw.severity)}"
								>
									{pw.hueDelta.toFixed(1)}° apart
								</span>
								<span
									class="text-[10px] font-mono font-600 px-2 py-0.5 rounded-md uppercase"
									style="background: {severityColor(pw.severity)}15; color: {severityColor(pw.severity)}"
								>
									{pw.suggestedAction === 'merge' ? 'Merge suggested' : 'Shift suggested'}
								</span>
							</div>
							<p class="font-body text-[12px] mt-1" style="color: var(--text-tertiary)">
								{pw.suggestion}
							</p>

							<!-- Actionable shift preview -->
							{#if pw.suggestedAction === 'shift' && pw.shiftTarget && pw.shiftedHex}
								<div class="flex items-center gap-3 mt-2.5">
									<div class="flex items-center gap-1.5">
										<div class="w-4 h-4 rounded-sm ring-1 ring-white/10"
											style="background-color: {pw.shiftTarget === pw.familyA ? hexA : hexB}"
										></div>
										<span class="font-mono text-[10px]" style="color: var(--text-ghost)">→</span>
										<div class="w-4 h-4 rounded-sm ring-1 ring-white/10"
											style="background-color: {pw.shiftedHex}"
										></div>
									</div>
									<span class="font-body text-[11px]" style="color: var(--text-tertiary)">
										{pw.shiftTarget}: {pw.shiftTarget === pw.familyA ? pw.hueA.toFixed(0) : pw.hueB.toFixed(0)}° → {pw.shiftedHue?.toFixed(0)}°
									</span>
									{#if onSelectFamily}
										<button
											class="font-body text-[10px] font-500 px-2 py-0.5 rounded-md cursor-pointer transition-all hover:opacity-80"
											style="background: rgba(255,255,255,0.06); color: var(--text-secondary)"
											title="Load the shifted hue into the generator to preview"
											onclick={() => onSelectFamily(pw.shiftedHex!, pw.shiftTarget!)}
										>
											Preview shift
										</button>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Gap Suggestions — tiered -->
	{#if audit.gapSuggestions.length > 0}
		<div
			class="rounded-2xl overflow-hidden"
			style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
		>
			<!-- Header -->
			<div class="px-5 py-3.5" style="border-bottom: 1px solid var(--border-subtle)">
				<div class="flex items-center justify-between">
					<div>
						<p class="font-display text-[13px] font-600" style="color: var(--text-primary)">Suggested Additions</p>
						<p class="font-body text-[12px] mt-0.5" style="color: var(--text-tertiary)">
							Ranked by hue coverage, chroma compatibility, and warm/cool balance
						</p>
					</div>
					<span class="text-[10px] font-mono font-600 px-2 py-0.5 rounded-md" style="background: rgba(255,255,255,0.06); color: var(--text-tertiary)">
						{audit.gapSuggestions.length} {audit.gapSuggestions.length === 1 ? 'suggestion' : 'suggestions'}
					</span>
				</div>

				<!-- Palette capacity bar -->
				<div class="mt-3 flex items-center gap-3">
					<span class="shrink-0 font-body text-[11px] font-500" style="color: var(--text-tertiary)">Palette capacity</span>
					<div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.06)">
						<div
							class="h-full rounded-full transition-all duration-500"
							style="width: {Math.min(100, capacityPct)}%; background: {capacityColor}"
						></div>
					</div>
					<span class="shrink-0 font-mono text-[11px] font-600" style="color: {capacityColor}">
						{audit.familyCount}/{MAX_PALETTE_SIZE}
					</span>
					{#if audit.coverageStats.balance !== 'balanced'}
						<span
							class="shrink-0 text-[10px] font-mono font-500 px-2 py-0.5 rounded-md"
							style="background: rgba(245, 158, 11, 0.08); color: rgba(245, 158, 11, 0.85)"
						>
							{audit.coverageStats.balance.replace('-', ' ')}
						</span>
					{/if}
				</div>
			</div>

			<!-- Tiered suggestions -->
			<div class="px-5 py-4 space-y-5">
				{#each tiers as tier, tierIdx (tier.label)}
					{@const isStrong = tierIdx === 0 && tier.items[0]?.score >= TIER_STRONG}
					<div>
						<!-- Tier header -->
						<div class="flex items-center justify-between mb-3">
							<div class="flex items-center gap-2.5">
								<div class="w-1.5 h-1.5 rounded-full" style="background: {tier.accent}"></div>
								<span class="font-display text-[12px] font-600 uppercase tracking-[0.06em]" style="color: {tier.accent}">
									{tier.label}
								</span>
								<span class="font-mono text-[11px]" style="color: var(--text-ghost)">
									{tier.items.length}
								</span>
							</div>
							{#if isStrong && onAddToWorkspace && tier.items.length > 1}
								<button
									onclick={handleAddAllRecommended}
									class="font-body text-[11px] font-500 px-3 py-1 rounded-lg cursor-pointer transition-all duration-200 hover:opacity-80"
									style="background: rgba(74, 222, 128, 0.08); border: 1px solid rgba(74, 222, 128, 0.20); color: rgba(74, 222, 128, 0.85)"
								>
									+ Add all {tier.items.length}
								</button>
							{/if}
						</div>

						{#if tier.sublabel}
							<p class="font-body text-[11px] mb-3 -mt-1" style="color: var(--text-ghost)">
								{tier.sublabel}
							</p>
						{/if}

						<!-- Cards grid -->
						<div class="grid gap-2.5" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))">
							{#each tier.items as sug, i (sug.name + sug.source)}
								{@const badge = sourceBadgeStyle(sug.source)}
								{@const rank = globalRank(sug)}
								<div
									class="group relative flex items-start gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 hover:ring-1 hover:ring-white/15"
									style="
										background: {tier.accentBg};
										border: 1px solid {isStrong ? tier.accent + '20' : 'var(--border-subtle)'};
										opacity: 0;
										animation: card-enter 0.35s cubic-bezier(0.22, 1, 0.36, 1) {(tierIdx * 120) + (i * 50)}ms both;
									"
								>
									<!-- Rank number -->
									<div
										class="shrink-0 w-6 h-6 rounded-md flex items-center justify-center font-mono text-[11px] font-700"
										style="background: rgba(255,255,255,0.06); color: {rank <= 3 ? tier.accent : 'var(--text-ghost)'}"
									>
										{rank}
									</div>

									<!-- Swatch -->
									<button
										class="w-8 h-8 rounded-lg shrink-0 ring-1 ring-white/10 transition-transform duration-200 hover:scale-110 cursor-pointer"
										style="background-color: {sug.hex}"
										title="Preview {sug.name} in the generator"
										onclick={() => onSelectFamily?.(sug.hex, sug.name)}
									></button>

									<!-- Content -->
									<div class="flex-1 min-w-0">
										<!-- Name + source -->
										<div class="flex items-center gap-2">
											<button
												class="font-display text-[13px] font-600 truncate cursor-pointer hover:opacity-70 transition-opacity"
												style="color: var(--text-primary)"
												title="Preview {sug.name}"
												onclick={() => onSelectFamily?.(sug.hex, sug.name)}
											>
												{sug.name}
											</button>
											<span
												class="shrink-0 text-[9px] font-mono font-600 px-1.5 py-0.5 rounded-md"
												style="background: {badge.bg}; color: {badge.color}"
											>
												{sug.source}
											</span>
										</div>

										<!-- Score bar -->
										<div class="flex items-center gap-2 mt-1.5">
											<div class="flex-1 h-1 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.06)">
												<div
													class="h-full rounded-full transition-all duration-500"
													style="width: {Math.round(sug.score * 100)}%; background: {tier.accent}"
												></div>
											</div>
											<span class="shrink-0 font-mono text-[10px] font-600" style="color: {tier.accent}">
												{Math.round(sug.score * 100)}
											</span>
										</div>

										<!-- Signal dots -->
										<div class="flex items-center gap-3 mt-1.5">
											<div class="flex items-center gap-1" title="Hue position: {signalLabel(sug.hueScore)} ({Math.round(sug.hueScore * 100)}%) — how centrally this colour fills a hue gap">
												<div class="w-[6px] h-[6px] rounded-full" style="background: {signalColor(sug.hueScore)}"></div>
												<span class="font-mono text-[9px]" style="color: var(--text-ghost)">Hue</span>
											</div>
											<div class="flex items-center gap-1" title="Saturation match: {signalLabel(sug.chromaScore)} ({Math.round(sug.chromaScore * 100)}%) — how well the saturation matches your palette's median">
												<div class="w-[6px] h-[6px] rounded-full" style="background: {signalColor(sug.chromaScore)}"></div>
												<span class="font-mono text-[9px]" style="color: var(--text-ghost)">Saturation</span>
											</div>
											<div class="flex items-center gap-1" title="Warm/cool balance: {signalLabel(sug.balanceScore)} ({Math.round(sug.balanceScore * 100)}%) — whether this colour corrects a warm/cool imbalance in your palette">
												<div class="w-[6px] h-[6px] rounded-full" style="background: {signalColor(sug.balanceScore)}"></div>
												<span class="font-mono text-[9px]" style="color: var(--text-ghost)">Balance</span>
											</div>
										</div>

										<!-- Gap context -->
										<p class="font-body text-[11px] mt-1.5 truncate" style="color: var(--text-ghost)">
											{sug.gapSize.toFixed(0)}° gap between {sug.between[0]} and {sug.between[1]}
										</p>
									</div>

									<!-- Add button -->
									{#if onAddToWorkspace}
										<button
											class="shrink-0 self-center font-body text-[11px] font-500 px-2.5 py-1 rounded-lg cursor-pointer transition-all duration-200 hover:opacity-80"
											style="background: rgba(255,255,255,0.08); border: 1px solid var(--border-subtle); color: var(--text-secondary)"
											title="Add {sug.name} to workspace"
											onclick={() => onAddToWorkspace(sug.hex, sug.name, sug.source)}
										>
											+ Add
										</button>
									{/if}
								</div>
							{/each}
						</div>
					</div>

					<!-- Divider between tiers (not after last) -->
					{#if tierIdx < tiers.length - 1}
						<div class="h-px" style="background: var(--border-subtle)"></div>
					{/if}
				{/each}
			</div>

			<!-- Footer -->
			<div class="px-5 pb-4 flex items-center gap-2">
				<p class="font-body text-[11px]" style="color: var(--text-ghost)">
					Sourced from Tailwind CSS v4, Adobe Spectrum 2, and Radix Colors.
				</p>
				<span
					class="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-600 cursor-help"
					style="background: rgba(255,255,255,0.06); color: var(--text-ghost)"
					title="Scoring formula: hue position (40%) + saturation match (35%) + warm/cool balance correction (25%). Higher scores mean the addition improves your palette's overall coverage and harmony."
				>
					i
				</span>
			</div>
		</div>
	{:else if audit.coverageStats.remainingSlots === 0}
		<div
			class="rounded-2xl overflow-hidden"
			style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
		>
			<div class="px-5 py-4 flex items-center gap-3">
				<div class="w-2 h-2 rounded-full" style="background: rgba(74, 222, 128, 0.85)"></div>
				<p class="font-body text-[13px]" style="color: var(--text-secondary)">
					Palette is at capacity ({audit.familyCount}/{MAX_PALETTE_SIZE}) — no further additions needed.
				</p>
			</div>
		</div>
	{/if}

</div>
