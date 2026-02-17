<script lang="ts">
	import type { ScaleResult } from '$lib/scale';
	import { simulateHex, CVD_LABELS, CVD_DESCRIPTIONS } from '$lib/cvd-simulation';
	import type { CVDType } from '$lib/cvd-simulation';

	let { scale }: { scale: ScaleResult } = $props();

	type PreviewTab = 'tokens' | 'components' | 'cvd';
	let activeTab = $state<PreviewTab>('tokens');

	// Design system text tokens
	const GREY_750 = '#1D1D1D';
	const GREY_750_69 = 'rgba(29, 29, 29, 0.69)';
	const GREY_50 = '#FDFDFD';
	const GREY_50_72 = 'rgba(253, 253, 253, 0.72)';

	// Shade accessors
	let s50 = $derived(scale.shades[0]?.hex ?? '#F5F5F5');
	let s100 = $derived(scale.shades[1]?.hex ?? '#E5E5E5');
	let s200 = $derived(scale.shades[2]?.hex ?? '#A0A0A0');
	let s300 = $derived(scale.shades[3]?.hex ?? '#3B82F6');
	let s400 = $derived(scale.shades[4]?.hex ?? '#333333');
	let s500 = $derived(scale.shades[5]?.hex ?? '#222222');

	// CVD
	const cvdTypes: CVDType[] = ['normal', 'protanopia', 'deuteranopia', 'tritanopia'];
	const cvdBadge: Record<CVDType, string> = {
		normal: 'var(--text-tertiary)',
		protanopia: 'rgba(239, 68, 68, 0.7)',
		deuteranopia: 'rgba(249, 115, 22, 0.7)',
		tritanopia: 'rgba(59, 130, 246, 0.7)'
	};
</script>

<div
	class="rounded-2xl overflow-hidden"
	style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
>
	<!-- Tab bar -->
	<div class="flex items-center gap-0 px-5" style="border-bottom: 1px solid var(--border-subtle)">
		<button
			onclick={() => activeTab = 'tokens'}
			class="flex items-center gap-1.5 px-4 py-3 font-body text-[13px] font-500 cursor-pointer transition-all duration-200 relative"
			style="color: {activeTab === 'tokens' ? 'var(--text-primary)' : 'var(--text-tertiary)'}"
		>
			Token Usage
			{#if activeTab === 'tokens'}
				<div class="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style="background: var(--text-primary)"></div>
			{/if}
		</button>
		<button
			onclick={() => activeTab = 'components'}
			class="flex items-center gap-1.5 px-4 py-3 font-body text-[13px] font-500 cursor-pointer transition-all duration-200 relative"
			style="color: {activeTab === 'components' ? 'var(--text-primary)' : 'var(--text-tertiary)'}"
		>
			Component Preview
			{#if activeTab === 'components'}
				<div class="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style="background: var(--text-primary)"></div>
			{/if}
		</button>
		<button
			onclick={() => activeTab = 'cvd'}
			class="flex items-center gap-1.5 px-4 py-3 font-body text-[13px] font-500 cursor-pointer transition-all duration-200 relative"
			style="color: {activeTab === 'cvd' ? 'var(--text-primary)' : 'var(--text-tertiary)'}"
		>
			Colour Blindness Preview
			{#if activeTab === 'cvd'}
				<div class="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style="background: var(--text-primary)"></div>
			{/if}
		</button>
		<div class="flex-1"></div>
		<span class="font-body text-[11px]" style="color: var(--text-ghost)">
			{#if activeTab === 'tokens'}Light / dark mode semantic roles{:else if activeTab === 'components'}Realistic UI patterns using your palette{:else}
				<span title="Simulates how your palette appears to people with colour vision deficiencies (protanopia, deuteranopia, tritanopia)">Colour blindness simulation model</span>
			{/if}
		</span>
	</div>

	<!-- Token Usage tab -->
	{#if activeTab === 'tokens'}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-0">
			<!-- Light Mode -->
			<div class="p-5" style="background: #FFFFFF">
				<span class="block font-mono text-[10px] uppercase tracking-wide mb-3" style="color: {GREY_750_69}">Light Mode</span>

				<div class="rounded-xl px-4 py-3 mb-3" style="background: {s50}">
					<span class="font-body text-[12px]" style="color: {GREY_750}">Tertiary background with primary text</span>
					<span class="block font-mono text-[10px] mt-0.5" style="color: {GREY_750_69}">Shade 50 · Grey 750</span>
				</div>

				<div class="flex items-center gap-2 mb-3">
					<span class="inline-flex items-center px-3 py-1.5 rounded-lg font-body text-[12px] font-500" style="background: {s100}; color: {GREY_750}">
						Secondary badge
					</span>
					<span class="font-mono text-[10px]" style="color: {GREY_750_69}">Shade 100</span>
				</div>

				<div class="flex items-center gap-2">
					<button
						class="px-5 py-2 rounded-xl font-body text-[13px] font-500"
						style="background: {s300}; color: {GREY_50}; cursor: default"
					>
						Primary Action
					</button>
					<span class="font-mono text-[10px]" style="color: {GREY_750_69}">Shade 300 · Grey 50</span>
				</div>
			</div>

			<!-- Dark Mode -->
			<div class="p-5" style="background: #111113; border-left: 1px solid var(--border-subtle)">
				<span class="block font-mono text-[10px] uppercase tracking-wide mb-3" style="color: {GREY_50_72}">Dark Mode</span>

				<div class="rounded-xl px-4 py-3 mb-3" style="background: {s500}">
					<span class="font-body text-[12px]" style="color: {GREY_50}">Tertiary background with primary text</span>
					<span class="block font-mono text-[10px] mt-0.5" style="color: {GREY_50_72}">Shade 500 · Grey 50</span>
				</div>

				<div class="flex items-center gap-2 mb-3">
					<span class="inline-flex items-center px-3 py-1.5 rounded-lg font-body text-[12px] font-500" style="background: {s400}; color: {GREY_50}">
						Secondary badge
					</span>
					<span class="font-mono text-[10px]" style="color: {GREY_50_72}">Shade 400</span>
				</div>

				<div class="flex items-center gap-2">
					<button
						class="px-5 py-2 rounded-xl font-body text-[13px] font-500"
						style="background: {s200}; color: {GREY_750}; cursor: default"
					>
						Primary Action
					</button>
					<span class="font-mono text-[10px]" style="color: {GREY_50_72}">Shade 200 · Grey 750</span>
				</div>
			</div>
		</div>
	{/if}

	<!-- Component Preview tab -->
	{#if activeTab === 'components'}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-0">
			<!-- Light Mode components -->
			<div class="p-5 space-y-4" style="background: #FFFFFF">
				<span class="block font-mono text-[10px] uppercase tracking-wide mb-3" style="color: {GREY_750_69}">Light Mode</span>

				<!-- Buttons -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_750_69}">Buttons</span>
					<div class="flex flex-wrap items-center gap-2">
						<button
							class="px-4 py-2 rounded-lg font-body text-[13px] font-500"
							style="background: {s300}; color: {GREY_50}; cursor: default"
						>Primary</button>
						<button
							class="px-4 py-2 rounded-lg font-body text-[13px] font-500"
							style="background: transparent; color: {s300}; border: 1.5px solid {s300}; cursor: default"
						>Secondary</button>
						<button
							class="px-4 py-2 rounded-lg font-body text-[13px] font-500"
							style="background: {s50}; color: {s300}; cursor: default"
						>Tertiary</button>
						<button
							class="px-4 py-2 rounded-lg font-body text-[13px] font-500 opacity-40"
							style="background: {s100}; color: {GREY_750}; cursor: not-allowed"
						>Disabled</button>
					</div>
				</div>

				<!-- Form input -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_750_69}">Form Input</span>
					<div class="flex flex-col gap-1.5">
						<span class="font-body text-[12px] font-500" style="color: {GREY_750}">Email address</span>
						<div
							class="flex items-center rounded-lg px-3 py-2.5"
							style="border: 1.5px solid {s100}; background: #FFFFFF; box-shadow: 0 0 0 3px {s50}"
						>
							<span class="font-body text-[13px]" style="color: {GREY_750_69}">user@example.com</span>
						</div>
						<span class="font-body text-[11px]" style="color: {s300}">This field uses shade 100 border and shade 50 focus ring</span>
					</div>
				</div>

				<!-- Card -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_750_69}">Card</span>
					<div class="rounded-xl overflow-hidden" style="border: 1px solid rgba(0,0,0,0.08)">
						<div class="px-4 py-3" style="background: {s300}">
							<span class="font-body text-[13px] font-600" style="color: {GREY_50}">Card Header</span>
						</div>
						<div class="px-4 py-3" style="background: {s50}">
							<span class="font-body text-[12px]" style="color: {GREY_750}">Card body content with tertiary background — shade 50 provides a subtle surface distinction.</span>
						</div>
						<div class="px-4 py-2.5" style="background: #FFFFFF; border-top: 1px solid rgba(0,0,0,0.06)">
							<span class="font-body text-[11px]" style="color: {GREY_750_69}">Footer · Shade 300 header, shade 50 body</span>
						</div>
					</div>
				</div>

				<!-- Alert -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_750_69}">Alert</span>
					<div class="flex rounded-lg overflow-hidden" style="background: {s50}; border: 1px solid {s100}">
						<div class="w-1 shrink-0" style="background: {s300}"></div>
						<div class="px-3.5 py-3">
							<span class="block font-body text-[12px] font-600" style="color: {GREY_750}">Informational message</span>
							<span class="block font-body text-[11px] mt-0.5" style="color: {GREY_750_69}">This alert uses shade 50 background, shade 100 border, and a shade 300 accent stripe.</span>
						</div>
					</div>
				</div>

				<!-- Badges -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_750_69}">Badges</span>
					<div class="flex flex-wrap items-center gap-2">
						<span
							class="inline-flex items-center px-2.5 py-1 rounded-md font-body text-[11px] font-500"
							style="background: {s300}; color: {GREY_50}"
						>Filled</span>
						<span
							class="inline-flex items-center px-2.5 py-1 rounded-md font-body text-[11px] font-500"
							style="background: transparent; color: {s300}; border: 1px solid {s300}"
						>Outlined</span>
						<span
							class="inline-flex items-center px-2.5 py-1 rounded-md font-body text-[11px] font-500"
							style="background: {s50}; color: {s300}"
						>Subtle</span>
						<span
							class="inline-flex items-center px-2.5 py-1 rounded-md font-body text-[11px] font-500"
							style="background: {s100}; color: {GREY_750}"
						>Neutral</span>
					</div>
				</div>
			</div>

			<!-- Dark Mode components -->
			<div class="p-5 space-y-4" style="background: #111113; border-left: 1px solid var(--border-subtle)">
				<span class="block font-mono text-[10px] uppercase tracking-wide mb-3" style="color: {GREY_50_72}">Dark Mode</span>

				<!-- Buttons -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_50_72}">Buttons</span>
					<div class="flex flex-wrap items-center gap-2">
						<button
							class="px-4 py-2 rounded-lg font-body text-[13px] font-500"
							style="background: {s200}; color: {GREY_750}; cursor: default"
						>Primary</button>
						<button
							class="px-4 py-2 rounded-lg font-body text-[13px] font-500"
							style="background: transparent; color: {s200}; border: 1.5px solid {s200}; cursor: default"
						>Secondary</button>
						<button
							class="px-4 py-2 rounded-lg font-body text-[13px] font-500"
							style="background: {s500}; color: {s200}; cursor: default"
						>Tertiary</button>
						<button
							class="px-4 py-2 rounded-lg font-body text-[13px] font-500 opacity-40"
							style="background: {s400}; color: {GREY_50}; cursor: not-allowed"
						>Disabled</button>
					</div>
				</div>

				<!-- Form input -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_50_72}">Form Input</span>
					<div class="flex flex-col gap-1.5">
						<span class="font-body text-[12px] font-500" style="color: {GREY_50}">Email address</span>
						<div
							class="flex items-center rounded-lg px-3 py-2.5"
							style="border: 1.5px solid {s400}; background: #111113; box-shadow: 0 0 0 3px {s500}"
						>
							<span class="font-body text-[13px]" style="color: {GREY_50_72}">user@example.com</span>
						</div>
						<span class="font-body text-[11px]" style="color: {s200}">This field uses shade 400 border and shade 500 focus ring</span>
					</div>
				</div>

				<!-- Card -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_50_72}">Card</span>
					<div class="rounded-xl overflow-hidden" style="border: 1px solid rgba(255,255,255,0.08)">
						<div class="px-4 py-3" style="background: {s200}">
							<span class="font-body text-[13px] font-600" style="color: {GREY_750}">Card Header</span>
						</div>
						<div class="px-4 py-3" style="background: {s500}">
							<span class="font-body text-[12px]" style="color: {GREY_50}">Card body content with tertiary background — shade 500 provides a subtle surface distinction.</span>
						</div>
						<div class="px-4 py-2.5" style="background: #111113; border-top: 1px solid rgba(255,255,255,0.06)">
							<span class="font-body text-[11px]" style="color: {GREY_50_72}">Footer · Shade 200 header, shade 500 body</span>
						</div>
					</div>
				</div>

				<!-- Alert -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_50_72}">Alert</span>
					<div class="flex rounded-lg overflow-hidden" style="background: {s500}; border: 1px solid {s400}">
						<div class="w-1 shrink-0" style="background: {s200}"></div>
						<div class="px-3.5 py-3">
							<span class="block font-body text-[12px] font-600" style="color: {GREY_50}">Informational message</span>
							<span class="block font-body text-[11px] mt-0.5" style="color: {GREY_50_72}">This alert uses shade 500 background, shade 400 border, and a shade 200 accent stripe.</span>
						</div>
					</div>
				</div>

				<!-- Badges -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_50_72}">Badges</span>
					<div class="flex flex-wrap items-center gap-2">
						<span
							class="inline-flex items-center px-2.5 py-1 rounded-md font-body text-[11px] font-500"
							style="background: {s200}; color: {GREY_750}"
						>Filled</span>
						<span
							class="inline-flex items-center px-2.5 py-1 rounded-md font-body text-[11px] font-500"
							style="background: transparent; color: {s200}; border: 1px solid {s200}"
						>Outlined</span>
						<span
							class="inline-flex items-center px-2.5 py-1 rounded-md font-body text-[11px] font-500"
							style="background: {s500}; color: {s200}"
						>Subtle</span>
						<span
							class="inline-flex items-center px-2.5 py-1 rounded-md font-body text-[11px] font-500"
							style="background: {s400}; color: {GREY_50}"
						>Neutral</span>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- CVD Simulation tab -->
	{#if activeTab === 'cvd'}
		<div class="px-5 py-4 space-y-3">
			{#each cvdTypes as cvdType, rowIdx (cvdType)}
				<div
					class="flex items-center gap-3"
					style="opacity: 0; animation: card-enter 0.3s cubic-bezier(0.22, 1, 0.36, 1) {rowIdx * 40}ms both"
				>
					<div class="w-[130px] shrink-0">
						<span class="block font-body text-[12px] font-500" style="color: {cvdBadge[cvdType]}">
							{CVD_LABELS[cvdType]}
						</span>
						<span class="block font-body text-[10px]" style="color: var(--text-ghost)">
							{CVD_DESCRIPTIONS[cvdType]}
						</span>
					</div>

					<div class="flex gap-[3px] flex-1">
						{#each scale.shades as shade (shade.shade)}
							{@const simHex = simulateHex(shade.hex, cvdType)}
							<div class="relative group flex-1">
								<div
									class="h-9 first:rounded-l-lg last:rounded-r-lg"
									style="background-color: {simHex}; border-radius: inherit"
									title="{scale.name}/{shade.shade} under {CVD_LABELS[cvdType]}: {simHex} (original: {shade.hex})"
								></div>
								<span
									class="absolute -bottom-5 left-1/2 -translate-x-1/2 font-mono text-[8px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none"
									style="color: var(--text-ghost)"
								>{simHex}</span>
							</div>
						{/each}
					</div>
				</div>
			{/each}

		<p class="font-body text-[11px] mt-2" style="color: var(--text-ghost)">
			<span title="Uses the Viénot 1999 algorithm, the same model used by Chrome DevTools">Simulated using Viénot 1999 matrices</span> (same as Chrome DevTools). ~8% of males and ~0.5% of females have some form of colour vision deficiency.
		</p>
		</div>
	{/if}
</div>
