<script lang="ts">
	import type { CoverageAnalysis, FamilyCoverage, PrimitiveUsage } from '$lib/primitive-coverage';

	let {
		coverage,
		onClear
	}: {
		coverage: CoverageAnalysis;
		onClear: () => void;
	} = $props();

	let showFamilies = $state(false);
	let showUnusedDetails = $state(false);
	let expandedFamily = $state<string | null>(null);
	let searchQuery = $state('');

	let allPrimitives = $derived([...coverage.used, ...coverage.unused]);

	let searchResults = $derived(() => {
		const q = searchQuery.trim().toLowerCase();
		if (q.length < 2) return null;
		return allPrimitives.filter(
			(p) =>
				`${p.family}/${p.shade}`.toLowerCase().includes(q) ||
				p.hex.toLowerCase().includes(q) ||
				p.usedIn.some((ref) => ref.path.toLowerCase().includes(q))
		);
	});

	function textColor(hex: string): string {
		const r = parseInt(hex.slice(1, 3), 16) / 255;
		const g = parseInt(hex.slice(3, 5), 16) / 255;
		const b = parseInt(hex.slice(5, 7), 16) / 255;
		return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#1a1a1a' : '#f5f5f5';
	}

	function copyHex(hex: string) {
		navigator.clipboard.writeText(hex).catch(() => {});
	}

	function pctColor(pct: number): { bg: string; fg: string } {
		if (pct >= 80) return { bg: 'rgba(16,185,129,0.10)', fg: '#10b981' };
		if (pct >= 50) return { bg: 'rgba(245,158,11,0.10)', fg: '#f59e0b' };
		return { bg: 'rgba(239,68,68,0.10)', fg: '#ef4444' };
	}

	let unusedByFamily = $derived(
		coverage.unused.reduce<Record<string, PrimitiveUsage[]>>((acc, p) => {
			if (!acc[p.family]) acc[p.family] = [];
			acc[p.family].push(p);
			return acc;
		}, {})
	);
</script>

<div
	class="rounded-2xl overflow-hidden"
	style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
>
	<!-- Header — compact, with inline progress -->
	<div class="px-4 py-3 flex items-center gap-3 flex-wrap" style="border-bottom: 1px solid var(--border-subtle)">
		<span class="font-display text-[14px] font-600" style="color: var(--text-primary)">Primitive Coverage</span>

		<!-- Inline micro progress bar -->
		<div class="flex items-center gap-2 flex-1 min-w-[120px] max-w-[200px]">
			<div class="flex-1 flex rounded-full overflow-hidden" style="height: 3px; background: rgba(255,255,255,0.06)">
				<div
					class="transition-all duration-500"
					style="width: {coverage.stats.pct}%; background: {pctColor(coverage.stats.pct).fg}; border-radius: 9999px"
				></div>
			</div>
			<span
				class="text-[10px] font-mono font-600 shrink-0"
				style="color: {pctColor(coverage.stats.pct).fg}"
			>{coverage.stats.pct}%</span>
		</div>

		<div class="flex items-center gap-2 ml-auto">
			<span class="text-[10px] font-mono" style="color: var(--text-ghost)">
				{coverage.stats.usedCount}/{coverage.stats.totalPrimitives}
			</span>
			<span class="text-[10px] font-mono" style="color: var(--text-ghost)">·</span>
			<span class="text-[10px] font-mono" style="color: var(--text-tertiary)">
				{coverage.stats.modesAnalysed.join(' + ')}
			</span>
			<button
				class="text-[10px] font-body font-500 px-1.5 py-0.5 rounded-md cursor-pointer transition-all hover:opacity-70 ml-1"
				style="background: rgba(239,68,68,0.06); color: #ef4444"
				onclick={onClear}
			>Remove semantic</button>
		</div>
	</div>

	<div class="p-4 space-y-3">
		<!-- Search -->
		<div>
			<div class="relative">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search primitives or tokens… (e.g. Grey/700)"
					class="w-full px-3 py-1.5 rounded-lg font-mono text-[11px] transition-all focus-visible:ring-1 focus-visible:ring-white/20"
					style="background: var(--surface-2); border: 1px solid var(--border-subtle); color: var(--text-primary); outline: none"
				/>
				{#if searchQuery.length > 0}
					<button
						class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-body cursor-pointer hover:opacity-70"
						style="color: var(--text-ghost)"
						onclick={() => (searchQuery = '')}
					>✕</button>
				{/if}
			</div>

			{#if searchResults()}
				{@const results = searchResults()!}
				<div class="mt-2 rounded-lg overflow-hidden" style="border: 1px solid var(--border-subtle)">
					{#if results.length === 0}
						<div class="px-3 py-2">
							<p class="text-[10px] font-body" style="color: var(--text-ghost)">No matches for "{searchQuery}"</p>
						</div>
					{:else}
						<div class="max-h-[240px] overflow-y-auto">
							<table class="w-full text-[10px] font-mono" style="border-collapse: collapse">
								<thead>
									<tr style="background: var(--surface-2)">
										<th class="text-left px-2.5 py-1.5 font-600 whitespace-nowrap" style="color: var(--text-secondary)">Primitive</th>
										<th class="text-left px-2.5 py-1.5 font-600 whitespace-nowrap" style="color: var(--text-secondary)">Hex</th>
										<th class="text-left px-2.5 py-1.5 font-600 whitespace-nowrap" style="color: var(--text-secondary)">Status</th>
										<th class="text-left px-2.5 py-1.5 font-600 whitespace-nowrap" style="color: var(--text-secondary)">Referenced by</th>
									</tr>
								</thead>
								<tbody>
									{#each results as prim, i}
										{@const isUsed = prim.usedIn.length > 0}
										<tr style="{i > 0 ? 'border-top: 1px solid var(--border-subtle)' : ''}; {i % 2 === 0 ? 'background: rgba(255,255,255,0.015)' : ''}">
											<td class="px-2.5 py-1">
												<span class="inline-flex items-center gap-1.5">
													<span class="w-3.5 h-3.5 rounded-sm shrink-0" style="background-color: {prim.hex}; outline: 1px solid rgba(255,255,255,0.1); outline-offset: -1px"></span>
													<span style="color: var(--text-primary)">{prim.family}/{prim.shade}</span>
												</span>
											</td>
											<td class="px-2.5 py-1">
												<button class="cursor-pointer hover:opacity-70" style="color: var(--text-tertiary)" onclick={() => copyHex(prim.hex)}>{prim.hex}</button>
											</td>
											<td class="px-2.5 py-1">
												{#if isUsed}
													<span class="text-[9px] font-600 px-1.5 py-0.5 rounded whitespace-nowrap" style="background: rgba(16,185,129,0.08); color: #10b981">
														Used ({prim.usedIn.length})
													</span>
												{:else}
													<span class="text-[9px] font-600 px-1.5 py-0.5 rounded whitespace-nowrap" style="background: rgba(239,68,68,0.08); color: #ef4444">
														Unused
													</span>
												{/if}
											</td>
											<td class="px-2.5 py-1">
												{#if prim.usedIn.length > 0}
													<div class="flex flex-col gap-0.5">
														{#each prim.usedIn as ref}
															<span class="inline-flex items-center gap-1">
																<span class="font-body" style="color: var(--text-secondary)">{ref.path}</span>
																<span class="text-[8px] px-1 py-0.5 rounded" style="background: rgba(255,255,255,0.04); color: var(--text-ghost)">{ref.mode}</span>
															</span>
														{/each}
													</div>
												{:else}
													<span class="font-body" style="color: var(--text-ghost)">—</span>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<div class="px-2.5 py-1" style="background: var(--surface-2); border-top: 1px solid var(--border-subtle)">
							<span class="text-[9px] font-body" style="color: var(--text-ghost)">{results.length} result{results.length !== 1 ? 's' : ''}</span>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Per-family breakdown (collapsible) -->
		<div>
			<button
				class="flex items-center gap-1.5 cursor-pointer group"
				onclick={() => (showFamilies = !showFamilies)}
			>
				<span
					class="text-[10px] font-display font-600 uppercase tracking-[0.10em] transition-colors group-hover:opacity-80"
					style="color: var(--text-ghost)"
				>Coverage by family</span>
				<span
					class="text-[9px] font-mono transition-transform"
					style="color: var(--text-ghost); transform: rotate({showFamilies ? '90deg' : '0deg'})"
				>▸</span>
				<span class="text-[9px] font-mono" style="color: var(--text-ghost)">
					{coverage.byFamily.length} families
				</span>
			</button>

			{#if showFamilies}
				<div class="mt-1.5 flex flex-wrap gap-x-1 gap-y-0.5">
					{#each coverage.byFamily as fam (fam.family)}
						{@const c = pctColor(fam.pct)}
						{@const isExpanded = expandedFamily === fam.family}
						<button
							class="inline-flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-all text-[10px] font-mono hover:opacity-80"
							style="background: {isExpanded ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)'}; border: 1px solid {isExpanded ? 'var(--border-subtle)' : 'transparent'}"
							onclick={() => (expandedFamily = isExpanded ? null : fam.family)}
						>
							<span class="font-display font-600" style="color: var(--text-primary)">{fam.family}</span>
							<span style="color: {c.fg}">{fam.used}/{fam.total}</span>
							{#if fam.unused > 0}
								<span class="text-[9px] px-1 py-px rounded" style="background: rgba(239,68,68,0.08); color: #ef4444">{fam.unused} unused</span>
							{/if}
						</button>

						{#if expandedFamily === fam.family}
							{@const familyUsed = coverage.used.filter((p) => p.family === fam.family)}
							{@const familyUnused = coverage.unused.filter((p) => p.family === fam.family)}
							{@const allShades = [...familyUsed, ...familyUnused].sort((a, b) => Number(a.shade) - Number(b.shade))}
							<div class="w-full mt-1 mb-2 px-2.5 py-2 rounded-lg" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle)">
								<div class="flex flex-wrap gap-0.5">
									{#each allShades as shade}
										{@const isUsed = shade.usedIn.length > 0}
										<button
											class="flex flex-col items-center gap-px cursor-pointer transition-opacity"
											style="opacity: {isUsed ? '1' : '0.35'}"
											title="{fam.family}/{shade.shade}: {shade.hex}{isUsed ? ` — used by ${shade.usedIn.length} token${shade.usedIn.length > 1 ? 's' : ''}` : ' — UNUSED'}"
											onclick={() => copyHex(shade.hex)}
										>
											<div
												class="w-5 h-5 rounded-sm flex items-center justify-center"
												style="background-color: {shade.hex}; outline: 1px solid rgba(255,255,255,0.08); outline-offset: -1px; {!isUsed ? 'background-image: repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(239,68,68,0.15) 2px, rgba(239,68,68,0.15) 3px)' : ''}"
											>
												{#if isUsed}
													<span class="font-mono text-[6px] font-600" style="color: {textColor(shade.hex)}">{shade.usedIn.length}</span>
												{/if}
											</div>
											<span class="font-mono text-[7px]" style="color: {isUsed ? 'var(--text-ghost)' : '#ef4444'}">{shade.shade}</span>
										</button>
									{/each}
								</div>

								{#if familyUsed.length > 0}
									<details class="mt-1.5">
										<summary class="text-[9px] font-body cursor-pointer" style="color: var(--text-ghost)">
											Token references ({familyUsed.reduce((sum, s) => sum + s.usedIn.length, 0)})
										</summary>
										<div class="mt-1 space-y-px max-h-[120px] overflow-y-auto">
											{#each familyUsed as shade}
												{#each shade.usedIn as ref}
													<div class="flex items-center gap-1.5 text-[9px] font-mono py-px">
														<div class="w-2.5 h-2.5 rounded-sm shrink-0" style="background-color: {shade.hex}; outline: 1px solid rgba(255,255,255,0.08)"></div>
														<span style="color: var(--text-ghost)">{shade.shade}</span>
														<span style="color: var(--text-tertiary)">→</span>
														<span style="color: var(--text-secondary)">{ref.path}</span>
														<span class="px-1 py-px rounded text-[8px]" style="background: rgba(255,255,255,0.04); color: var(--text-ghost)">{ref.mode}</span>
													</div>
												{/each}
											{/each}
										</div>
									</details>
								{/if}
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>

		<!-- Unused primitives summary -->
		{#if coverage.unused.length > 0}
			<div>
				<div class="flex items-center gap-2">
					<span class="text-[10px] font-display font-600 uppercase tracking-[0.10em]" style="color: var(--text-ghost)">
						Unused primitives
					</span>
					<span class="text-[9px] font-mono" style="color: #ef4444">{coverage.unused.length}</span>
					<button
						class="text-[9px] font-body font-500 px-1.5 py-0.5 rounded-md cursor-pointer transition-all hover:opacity-70"
						style="background: rgba(255,255,255,0.04); color: var(--text-ghost)"
						onclick={() => (showUnusedDetails = !showUnusedDetails)}
					>{showUnusedDetails ? 'Hide' : 'Show all'}</button>
				</div>

				{#if showUnusedDetails}
					<div class="space-y-2 mt-2">
						{#each Object.entries(unusedByFamily) as [family, shades] (family)}
							<div>
								<p class="font-display text-[10px] font-600 mb-0.5" style="color: var(--text-secondary)">
									{family}
									<span class="font-mono font-400 text-[9px]" style="color: var(--text-ghost)">({shades.length})</span>
								</p>
								<div class="flex flex-wrap gap-0.5">
									{#each shades.sort((a, b) => Number(a.shade) - Number(b.shade)) as shade}
										<button
											class="flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer transition-opacity hover:opacity-70"
											style="background: rgba(239,68,68,0.03); border: 1px solid rgba(239,68,68,0.10)"
											title="{family}/{shade.shade}: {shade.hex}"
											onclick={() => copyHex(shade.hex)}
										>
											<div class="w-3.5 h-3.5 rounded-sm" style="background-color: {shade.hex}; outline: 1px solid rgba(255,255,255,0.08); outline-offset: -1px"></div>
											<span class="font-mono text-[9px]" style="color: var(--text-tertiary)">{shade.shade}</span>
										</button>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Unknown references -->
		{#if coverage.unknownRefs.length > 0}
			<div>
				<div class="flex items-center gap-2">
					<span class="text-[10px] font-display font-600 uppercase tracking-[0.10em]" style="color: var(--text-ghost)">
						Unresolved references
					</span>
					<span
						class="text-[9px] font-body font-600 px-1.5 py-0.5 rounded"
						style="background: rgba(245,158,11,0.06); color: #f59e0b"
						title="Semantic tokens referencing primitives not found in the uploaded file"
					>{coverage.unknownRefs.length}</span>
				</div>
				<details class="mt-1.5">
					<summary class="text-[9px] font-body cursor-pointer" style="color: var(--text-ghost)">
						Show references
					</summary>
					<div class="mt-1 rounded-lg overflow-hidden" style="border: 1px solid var(--border-subtle)">
						<div class="max-h-[160px] overflow-y-auto">
							<table class="w-full text-[9px] font-mono" style="border-collapse: collapse">
								<thead>
									<tr style="background: var(--surface-2)">
										<th class="text-left px-2 py-1 font-600" style="color: var(--text-secondary)">Mode</th>
										<th class="text-left px-2 py-1 font-600" style="color: var(--text-secondary)">Token</th>
										<th class="text-left px-2 py-1 font-600" style="color: var(--text-secondary)">References</th>
									</tr>
								</thead>
								<tbody>
									{#each coverage.unknownRefs as ref, i}
										<tr style="{i > 0 ? 'border-top: 1px solid var(--border-subtle)' : ''}">
											<td class="px-2 py-0.5" style="color: var(--text-ghost)">{ref.mode}</td>
											<td class="px-2 py-0.5" style="color: var(--text-secondary)">{ref.path}</td>
											<td class="px-2 py-0.5" style="color: #f59e0b">{ref.ref}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</details>
			</div>
		{/if}
	</div>
</div>
