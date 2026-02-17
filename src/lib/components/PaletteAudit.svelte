<script lang="ts">
	import type { PaletteAudit } from '$lib/palette-audit';

	let {
		audit,
		onSelectFamily
	}: {
		audit: PaletteAudit;
		onSelectFamily?: (hex: string, name: string) => void;
	} = $props();

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
						<!-- Swatch pair -->
						<div class="flex items-center gap-1 shrink-0 mt-0.5">
							<div class="w-5 h-5 rounded-md ring-1 ring-white/10" style="background-color: {hexA}"></div>
							<div class="w-2 text-center font-mono text-[10px]" style="color: var(--text-ghost)">↔</div>
							<div class="w-5 h-5 rounded-md ring-1 ring-white/10" style="background-color: {hexB}"></div>
						</div>

						<div class="flex-1">
							<div class="flex items-center gap-2">
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
									{pw.severity}
								</span>
							</div>
							<p class="font-body text-[12px] mt-1" style="color: var(--text-tertiary)">
								{pw.suggestion}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Gap Suggestions -->
	{#if audit.gapSuggestions.length > 0}
		<div
			class="rounded-2xl overflow-hidden"
			style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
		>
			<div class="px-5 py-3.5 flex items-center justify-between" style="border-bottom: 1px solid var(--border-subtle)">
				<div>
				<p class="font-display text-[13px] font-600" style="color: var(--text-primary)">Suggested Additions</p>
				<p class="font-body text-[12px] mt-0.5" style="color: var(--text-tertiary)">Based on hue distribution analysis — click to generate a scale</p>
				</div>
				<span class="text-[10px] font-mono font-600 px-2 py-0.5 rounded-md" style="background: rgba(255,255,255,0.06); color: var(--text-tertiary)">
					{audit.gapSuggestions.length} {audit.gapSuggestions.length === 1 ? 'suggestion' : 'suggestions'}
				</span>
			</div>

			<div class="px-5 py-4">
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
					{#each audit.gapSuggestions as sug, i (sug.name + sug.source)}
						<button
							class="group relative flex items-center gap-3 px-4 py-3.5 rounded-xl text-left cursor-pointer transition-all duration-200 hover:ring-1 hover:ring-white/15"
							style="
								background: var(--surface-2);
								border: 1px dashed var(--border-medium);
								opacity: 0;
								animation: card-enter 0.4s cubic-bezier(0.22, 1, 0.36, 1) {i * 60}ms both;
							"
							title="Generate a {sug.name} scale from {sug.source} · fills {sug.gapSize.toFixed(0)}° gap between {sug.between[0]} and {sug.between[1]}"
							onclick={() => onSelectFamily?.(sug.hex, sug.name)}
						>
							<div
								class="w-9 h-9 rounded-lg shrink-0 ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-110"
								style="background-color: {sug.hex}"
							></div>

							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2">
									<span class="font-display text-[14px] font-600 truncate" style="color: var(--text-primary)">
										{sug.name}
									</span>
									<span
										class="shrink-0 text-[10px] font-mono font-600 px-2 py-0.5 rounded-md"
										style="background: {sug.source === 'Tailwind'
											? 'rgba(56, 189, 248, 0.10)'
											: 'rgba(168, 85, 247, 0.10)'};
										color: {sug.source === 'Tailwind'
											? 'rgba(56, 189, 248, 0.85)'
											: 'rgba(168, 85, 247, 0.85)'}"
									>
										{sug.source}
									</span>
								</div>
								<p class="font-body text-[12px] mt-0.5 truncate" style="color: var(--text-tertiary)">
									{sug.gapSize.toFixed(0)}° gap · {sug.between[0]} → {sug.between[1]}
								</p>
							</div>

							<span
								class="shrink-0 font-body text-[13px] opacity-0 group-hover:opacity-100 transition-opacity"
								style="color: var(--text-secondary)"
							>→</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="px-5 pb-4">
				<p class="font-body text-[12px]" style="color: var(--text-ghost)">
					Ranked by gap size. Sources: Tailwind CSS v4, Adobe Spectrum 2. Click to generate a 6-shade scale.
				</p>
			</div>
		</div>
	{/if}

</div>
