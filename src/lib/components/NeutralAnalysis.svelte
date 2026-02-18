<script lang="ts">
	import { analyseNeutrals } from '$lib/neutral-analysis';
	import type { NeutralAnalysis, NeutralShade, NeutralNameMatch, ShadeTintMatch, ProximityCluster, ConsolidatedShade } from '$lib/neutral-analysis';
	import type { AchromaticFamily } from '$lib/parse-tokens';

	let {
		families
	}: {
		families: AchromaticFamily[];
	} = $props();

	let analyses = $derived(families.map((f) => analyseNeutrals(f)));
	let expandedFamily = $state<string | null>(null);
	let activeTab = $state<Record<string, 'overview' | 'tint' | 'apca'>>({});

	function getTab(name: string): 'overview' | 'tint' | 'apca' {
		return activeTab[name] ?? 'overview';
	}
	function setTab(name: string, tab: 'overview' | 'tint' | 'apca') {
		activeTab = { ...activeTab, [name]: tab };
	}

	function apcaLabel(lc: number): { label: string; bg: string; color: string } {
		if (lc >= 75) return { label: 'Pass', bg: 'rgba(16,185,129,0.10)', color: '#10b981' };
		if (lc >= 60) return { label: 'Pass', bg: 'rgba(16,185,129,0.08)', color: '#10b981' };
		if (lc >= 45) return { label: 'Large', bg: 'rgba(245,158,11,0.10)', color: '#f59e0b' };
		return { label: 'Fail', bg: 'rgba(239,68,68,0.10)', color: '#ef4444' };
	}

	function textColor(hex: string): string {
		const r = parseInt(hex.slice(1, 3), 16) / 255;
		const g = parseInt(hex.slice(3, 5), 16) / 255;
		const b = parseInt(hex.slice(5, 7), 16) / 255;
		return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#1a1a1a' : '#f5f5f5';
	}

	function copyHex(hex: string) {
		navigator.clipboard.writeText(hex).catch(() => {});
	}

	function distColor(score: number): { bg: string; fg: string } {
		if (score >= 70) return { bg: 'rgba(16,185,129,0.10)', fg: '#10b981' };
		if (score >= 40) return { bg: 'rgba(245,158,11,0.10)', fg: '#f59e0b' };
		return { bg: 'rgba(239,68,68,0.10)', fg: '#ef4444' };
	}
</script>

{#each analyses as analysis (analysis.familyName)}
	{@const isExpanded = expandedFamily === analysis.familyName}
	{@const dc = distColor(analysis.distributionScore)}
	{@const tab = getTab(analysis.familyName)}

	<div
		class="rounded-2xl overflow-hidden mb-3"
		style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
	>
		<!-- ═══ Header — always visible ═══ -->
		<button
			class="w-full px-5 py-3.5 flex items-center gap-3 cursor-pointer transition-all hover:opacity-90"
			style="border-bottom: 1px solid {isExpanded ? 'var(--border-subtle)' : 'transparent'}"
			onclick={() => expandedFamily = isExpanded ? null : analysis.familyName}
		>
			<!-- Mini strip -->
			<div class="flex shrink-0 rounded overflow-hidden" style="height: 22px; width: 88px">
				{#each analysis.shades as s}
					<div class="flex-1" style="background-color: {s.hex}; min-width: 1px"></div>
				{/each}
			</div>

			<span class="font-display text-[15px] font-600" style="color: var(--text-primary)">{analysis.familyName}</span>

			{#if analysis.isAlpha}
				<span
					class="text-[11px] font-body font-600 px-2 py-0.5 rounded-md"
					style="background: rgba(99,102,241,0.10); color: rgba(129,140,248,0.9)"
				>Alpha</span>
			{/if}

			<span class="text-[12px] font-mono" style="color: var(--text-ghost)">{analysis.stats.totalShades} shades</span>

			<!-- Key stats as inline badges -->
			<div class="flex items-center gap-1.5 ml-auto">
				{#if analysis.stats.tintedCount > 0}
					<span class="text-[11px] font-body font-600 px-2 py-0.5 rounded-md"
						style="background: rgba(139,92,246,0.08); color: rgba(167,139,250,0.9)"
					>{analysis.stats.tintedCount} tinted</span>
				{/if}
				{#if analysis.proximityClusters.length > 0}
					<span class="text-[11px] font-body font-600 px-2 py-0.5 rounded-md"
						style="background: rgba(245,158,11,0.08); color: #f59e0b"
					>{analysis.proximityClusters.length} cluster{analysis.proximityClusters.length > 1 ? 's' : ''}</span>
				{/if}
				<span class="text-[11px] font-body font-600 px-2 py-0.5 rounded-md"
					style="background: {dc.bg}; color: {dc.fg}"
				>Dist {analysis.distributionScore}/100</span>
				{#if analysis.tintMatches.filter((m) => !m.isAchromatic).length > 0}
					{@const bestMatch = analysis.tintMatches.filter((m) => !m.isAchromatic)[0]}
					<span class="text-[11px] font-mono" style="color: var(--text-ghost)">≈ {bestMatch.name}</span>
				{/if}
				<span
					class="text-[11px] font-mono transition-transform"
					style="color: var(--text-ghost); transform: rotate({isExpanded ? '90deg' : '0deg'})"
				>▸</span>
			</div>
		</button>

		<!-- ═══ Expanded content ═══ -->
		{#if isExpanded}
			<div class="p-5 space-y-5">

				<!-- 1. THE STRIP — hero visual -->
				<div>
					<div class="flex rounded-lg overflow-hidden" style="height: 36px; outline: 1px solid rgba(255,255,255,0.06)">
						{#each analysis.shades as s}
							{@const isInCluster = analysis.proximityClusters.some((c) => c.shades.includes(s.shade))}
							<button
								class="flex-1 relative cursor-pointer transition-opacity hover:opacity-80"
								style="background-color: {s.hex}; min-width: 8px; {isInCluster ? 'box-shadow: inset 0 -3px 0 rgba(245,158,11,0.7)' : ''}"
								title="{analysis.familyName}/{s.shade}: {s.hex} · L*={s.L.toFixed(3)} — click to copy"
								onclick={() => copyHex(s.hex)}
							>
								<span
									class="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-600 opacity-0 hover:opacity-100 transition-opacity"
									style="color: {textColor(s.hex)}"
								>{s.hex}</span>
							</button>
						{/each}
					</div>
					<div class="flex mt-1">
						{#each analysis.shades as s}
							<div class="flex-1 flex justify-center" style="min-width: 8px">
								<span class="font-mono text-[9px]" style="color: var(--text-ghost)">{s.shade}</span>
							</div>
						{/each}
					</div>
				</div>

				<!-- 2. DIAGNOSIS — proximity + consolidation -->
				{#if analysis.proximityClusters.length > 0 || analysis.stats.totalShades > analysis.consolidated.length}
					<div class="rounded-xl p-4" style="background: rgba(255,255,255,0.015); border: 1px solid var(--border-subtle)">
						<!-- Proximity clusters -->
						{#if analysis.proximityClusters.length > 0}
							<div class="mb-4">
								<p class="text-[11px] font-display font-600 uppercase tracking-[0.08em] mb-2" style="color: var(--text-ghost)">
									Proximity · {analysis.stats.clusteredCount} shades in {analysis.proximityClusters.length} {analysis.proximityClusters.length === 1 ? 'cluster' : 'clusters'}
								</p>
								<div class="space-y-1.5">
									{#each analysis.proximityClusters as cluster}
										<div class="flex items-center gap-2.5 flex-wrap">
											<div class="flex shrink-0">
												{#each cluster.hexes as hex}
													<div class="w-5 h-5 first:rounded-l last:rounded-r" style="background-color: {hex}; outline: 1px solid rgba(255,255,255,0.08); outline-offset: -1px"></div>
												{/each}
											</div>
											<span class="font-mono text-[12px] font-600" style="color: rgba(245,158,11,0.85)">{cluster.shades.join(', ')}</span>
											<span class="text-[11px] font-body" style="color: var(--text-ghost)">{cluster.reason}</span>
											<span class="text-[11px] font-body" style="color: var(--text-tertiary)">Keep <strong>{cluster.keepShade}</strong>, drop {cluster.dropShades.join(', ')}</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Consolidation -->
						<div>
							<p class="text-[11px] font-display font-600 uppercase tracking-[0.08em] mb-2" style="color: var(--text-ghost)">
								Consolidation · {analysis.stats.totalShades} → {analysis.consolidated.length}
							</p>
							<div class="flex flex-col gap-1.5">
								<div class="flex items-center gap-3">
									<span class="text-[11px] font-body w-[56px] text-right shrink-0" style="color: var(--text-ghost)">Current</span>
									<div class="flex flex-1 rounded-md overflow-hidden" style="height: 18px">
										{#each analysis.shades as s}
											<div class="flex-1" style="background-color: {s.hex}; min-width: 2px" title="{s.shade}: {s.hex}"></div>
										{/each}
									</div>
									<span class="text-[11px] font-mono w-[20px] text-right shrink-0" style="color: var(--text-ghost)">{analysis.stats.totalShades}</span>
								</div>
								<div class="flex items-center gap-3">
									<span class="text-[11px] font-body w-[56px] text-right shrink-0" style="color: var(--text-ghost)">Proposed</span>
									<div class="flex flex-1 rounded-md overflow-hidden" style="height: 18px">
										{#each analysis.consolidated as c}
											<div class="flex-1" style="background-color: {c.hex}; min-width: 2px" title="{c.shade}: {c.hex} — {c.role}"></div>
										{/each}
									</div>
									<span class="text-[11px] font-mono w-[20px] text-right shrink-0" style="color: var(--text-ghost)">{analysis.consolidated.length}</span>
								</div>
							</div>

							<details class="mt-2.5">
								<summary class="text-[11px] font-body cursor-pointer" style="color: var(--text-ghost)">Shade mapping</summary>
								<div class="mt-2 flex flex-wrap gap-1.5">
									{#each analysis.consolidated as c}
										<div
											class="flex items-center gap-2 px-2 py-1.5 rounded-md"
											style="background: var(--surface-2); border: 1px solid var(--border-subtle)"
										>
											<div class="w-5 h-5 rounded-sm shrink-0" style="background-color: {c.hex}; outline: 1px solid rgba(255,255,255,0.06); outline-offset: -1px"></div>
											<span class="font-mono text-[11px] font-600" style="color: var(--text-primary)">{c.shade}</span>
											{#if c.originalShade !== undefined && c.originalShade !== c.shade}
												<span class="font-mono text-[10px]" style="color: var(--text-ghost)">← {c.originalShade}</span>
											{/if}
											<span class="text-[10px] font-body" style="color: var(--text-ghost)">{c.role}</span>
										</div>
									{/each}
								</div>
							</details>
						</div>
					</div>
				{/if}

				<!-- 3. DEEP DIVE — tabs -->
				<div>
					<div class="flex items-center gap-1 mb-3">
						<button
							class="text-[12px] font-body font-500 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
							style="background: {tab === 'overview' ? 'rgba(255,255,255,0.08)' : 'transparent'}; color: {tab === 'overview' ? 'var(--text-primary)' : 'var(--text-ghost)'}"
							onclick={() => setTab(analysis.familyName, 'overview')}
						>APCA readability</button>
						{#if analysis.stats.tintedCount > 0}
							<button
								class="text-[12px] font-body font-500 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
								style="background: {tab === 'tint' ? 'rgba(255,255,255,0.08)' : 'transparent'}; color: {tab === 'tint' ? 'var(--text-primary)' : 'var(--text-ghost)'}"
								onclick={() => setTab(analysis.familyName, 'tint')}
							>Tint analysis
								{#if !analysis.tintConsistent}
									<span class="inline-block w-1.5 h-1.5 rounded-full ml-1" style="background: #f59e0b; vertical-align: middle"></span>
								{/if}
							</button>
						{/if}
					</div>

					<!-- APCA tab -->
					{#if tab === 'overview'}
						<div class="flex flex-wrap gap-1">
							{#each analysis.shades as s}
								{@const best = Math.max(s.apcaOnWhite, s.apcaOnDark)}
								{@const badge = apcaLabel(best)}
								<button
									class="flex flex-col items-center gap-0.5 cursor-pointer transition-opacity hover:opacity-80"
									title="{s.shade}: Lc {s.apcaOnWhite.toFixed(0)} on white, Lc {s.apcaOnDark.toFixed(0)} on dark"
									onclick={() => copyHex(s.hex)}
								>
									<div
										class="w-8 h-8 rounded flex items-center justify-center"
										style="background-color: {s.hex}; outline: 1px solid rgba(255,255,255,0.08); outline-offset: -1px"
									>
										<span class="font-mono text-[8px] font-600" style="color: {textColor(s.hex)}">{best.toFixed(0)}</span>
									</div>
									<span class="font-mono text-[9px]" style="color: {badge.color}">{s.shade}</span>
								</button>
							{/each}
						</div>

						<details class="mt-3">
							<summary class="text-[11px] font-body cursor-pointer" style="color: var(--text-ghost)">Full APCA table</summary>
							<div class="mt-2 rounded-xl overflow-hidden" style="border: 1px solid var(--border-subtle)">
								<div class="overflow-x-auto">
									<table class="w-full text-[12px] font-mono" style="border-collapse: collapse">
										<thead>
											<tr style="background: var(--surface-2)">
												<th class="text-left px-3 py-2 font-600" style="color: var(--text-secondary)">Shade</th>
												<th class="text-left px-3 py-2 font-600" style="color: var(--text-secondary)">Hex</th>
												<th class="text-right px-3 py-2 font-600" style="color: var(--text-secondary)">L*</th>
												<th class="text-right px-3 py-2 font-600" style="color: var(--text-secondary)">On white</th>
												<th class="text-right px-3 py-2 font-600" style="color: var(--text-secondary)">On dark</th>
												<th class="text-left px-3 py-2 font-600" style="color: var(--text-secondary)">Best use</th>
											</tr>
										</thead>
										<tbody>
											{#each analysis.shades as s, i}
												{@const onW = apcaLabel(s.apcaOnWhite)}
												{@const onD = apcaLabel(s.apcaOnDark)}
												{@const use = s.L > 0.85 ? 'Light bg' : s.L > 0.6 ? 'Border / surface' : s.L > 0.4 ? 'Text on dark' : s.L > 0.2 ? 'Text on light' : 'Dark bg'}
												<tr style="{i > 0 ? 'border-top: 1px solid var(--border-subtle)' : ''}; {i % 2 === 0 ? 'background: rgba(255,255,255,0.015)' : ''}">
													<td class="px-3 py-1.5">
														<span class="inline-flex items-center gap-1.5">
															<span class="w-4 h-4 rounded-sm" style="background-color: {s.hex}; outline: 1px solid rgba(255,255,255,0.1); outline-offset: -1px"></span>
															<span style="color: var(--text-primary)">{s.shade}</span>
														</span>
													</td>
													<td class="px-3 py-1.5">
														<button class="cursor-pointer hover:opacity-70" style="color: var(--text-tertiary)" onclick={() => copyHex(s.hex)}>{s.hex}</button>
													</td>
													<td class="text-right px-3 py-1.5" style="color: var(--text-tertiary)">{(s.L * 100).toFixed(1)}</td>
													<td class="text-right px-3 py-1.5">
														<span class="text-[11px] font-600 px-1.5 py-0.5 rounded" style="background: {onW.bg}; color: {onW.color}">
															{s.apcaOnWhite.toFixed(0)} {onW.label}
														</span>
													</td>
													<td class="text-right px-3 py-1.5">
														<span class="text-[11px] font-600 px-1.5 py-0.5 rounded" style="background: {onD.bg}; color: {onD.color}">
															{s.apcaOnDark.toFixed(0)} {onD.label}
														</span>
													</td>
													<td class="px-3 py-1.5 font-body text-[11px]" style="color: var(--text-ghost)">{use}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						</details>
					{/if}

					<!-- Tint tab -->
					{#if tab === 'tint'}
						{@const tintedShades = analysis.shades.filter((s) => s.isTinted)}
						<div>
							<div class="flex items-center gap-2 mb-2.5">
								{#if analysis.tintConsistent}
									<span class="text-[11px] font-body font-600 px-2 py-0.5 rounded-md" style="background: rgba(16,185,129,0.08); color: #10b981">Consistent</span>
								{:else}
									<span class="text-[11px] font-body font-600 px-2 py-0.5 rounded-md" style="background: rgba(245,158,11,0.08); color: #f59e0b">Tint drift detected</span>
								{/if}
								<span class="text-[11px] font-mono" style="color: var(--text-ghost)">{analysis.stats.tintedCount} of {analysis.stats.totalShades} shades</span>
								{#if analysis.tintMatches.filter((m) => !m.isAchromatic).length > 0}
									<span class="text-[11px] font-body" style="color: var(--text-ghost)">·</span>
									{#each analysis.tintMatches.filter((m) => !m.isAchromatic) as match}
										{@const sourceColor = match.source === 'Tailwind' ? 'rgba(56,189,248,0.9)' : 'rgba(167,139,250,0.9)'}
										{@const tag = match.source === 'Tailwind' ? 'TW' : 'RX'}
										<span class="text-[11px] font-body" style="color: var(--text-secondary)">
											<span style="color: {sourceColor}" class="font-600">{tag}</span> {match.name}
										</span>
									{/each}
								{/if}
							</div>

							<div class="rounded-xl overflow-hidden" style="border: 1px solid var(--border-subtle)">
								<div class="overflow-x-auto">
									<table class="w-full text-[12px] font-mono" style="border-collapse: collapse">
										<thead>
											<tr style="background: var(--surface-2)">
												<th class="text-left px-3 py-2 font-600" style="color: var(--text-secondary)">Shade</th>
												<th class="text-right px-3 py-2 font-600" style="color: var(--text-secondary)">Hue</th>
												<th class="text-right px-3 py-2 font-600" style="color: var(--text-secondary)">Chroma</th>
												<th class="text-left px-3 py-2 font-600" style="color: var(--text-secondary)">
													<span class="text-[10px] font-body font-600 px-1.5 py-0.5 rounded" style="background: rgba(56,189,248,0.06); color: rgba(56,189,248,0.9)">TW</span>
													Tailwind
												</th>
												<th class="text-left px-3 py-2 font-600" style="color: var(--text-secondary)">
													<span class="text-[10px] font-body font-600 px-1.5 py-0.5 rounded" style="background: rgba(167,139,250,0.06); color: rgba(167,139,250,0.9)">RX</span>
													Radix
												</th>
											</tr>
										</thead>
										<tbody>
											{#each tintedShades as s, i}
												{@const twMatch = s.tintMatches.find((m) => m.source === 'Tailwind')}
												{@const rxMatch = s.tintMatches.find((m) => m.source === 'Radix')}
												<tr style="{i > 0 ? 'border-top: 1px solid var(--border-subtle)' : ''}; {i % 2 === 0 ? 'background: rgba(255,255,255,0.015)' : ''}">
													<td class="px-3 py-2">
														<span class="inline-flex items-center gap-1.5">
															<span class="w-4 h-4 rounded-sm" style="background-color: {s.hex}; outline: 1px solid rgba(255,255,255,0.1); outline-offset: -1px"></span>
															<span style="color: var(--text-primary)">{s.shade}</span>
														</span>
													</td>
													<td class="text-right px-3 py-2" style="color: var(--text-tertiary)">{s.H.toFixed(0)}°</td>
													<td class="text-right px-3 py-2" style="color: var(--text-tertiary)">{(s.C * 100).toFixed(2)}%</td>
													<td class="px-3 py-2">
														{#if twMatch}
															<span class="inline-flex items-center gap-1.5">
																<span class="font-body font-600" style="color: var(--text-primary)">{twMatch.name}</span>
																<span class="text-[10px] px-1.5 py-0.5 rounded font-600"
																	style="background: {twMatch.hueDelta <= 15 ? 'rgba(16,185,129,0.08)' : twMatch.hueDelta <= 30 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)'}; color: {twMatch.hueDelta <= 15 ? '#10b981' : twMatch.hueDelta <= 30 ? '#f59e0b' : '#ef4444'}"
																>Δ{twMatch.hueDelta}°</span>
															</span>
														{/if}
													</td>
													<td class="px-3 py-2">
														{#if rxMatch}
															<span class="inline-flex items-center gap-1.5">
																<span class="font-body font-600" style="color: var(--text-primary)">{rxMatch.name}</span>
																<span class="text-[10px] px-1.5 py-0.5 rounded font-600"
																	style="background: {rxMatch.hueDelta <= 15 ? 'rgba(16,185,129,0.08)' : rxMatch.hueDelta <= 30 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)'}; color: {rxMatch.hueDelta <= 15 ? '#10b981' : rxMatch.hueDelta <= 30 ? '#f59e0b' : '#ef4444'}"
																>Δ{rxMatch.hueDelta}°</span>
															</span>
														{/if}
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					{/if}
				</div>

			</div>
		{/if}
	</div>
{/each}
