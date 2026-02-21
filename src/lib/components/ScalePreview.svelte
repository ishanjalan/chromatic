<script lang="ts">
	import type { ScaleResult } from '$lib/scale';
	import { simulateHex, CVD_LABELS, CVD_DESCRIPTIONS } from '$lib/cvd-simulation';
	import type { CVDType } from '$lib/cvd-simulation';

	let { scale }: { scale: ScaleResult } = $props();

	type PreviewTab = 'preview' | 'cvd';
	let activeTab = $state<PreviewTab>('preview');

	const GREY_750 = '#1D1D1D';
	const GREY_750_69 = 'rgba(29, 29, 29, 0.69)';
	const GREY_50 = '#FFFFFF';
	const GREY_50_72 = 'rgba(255, 255, 255, 0.72)';

	let s50 = $derived(scale.shades[0]?.hex ?? '#F5F5F5');
	let s100 = $derived(scale.shades[1]?.hex ?? '#E5E5E5');
	let s200 = $derived(scale.shades[2]?.hex ?? '#A0A0A0');
	let s300 = $derived(scale.shades[3]?.hex ?? '#3B82F6');
	let s400 = $derived(scale.shades[4]?.hex ?? '#333333');
	let s500 = $derived(scale.shades[5]?.hex ?? '#222222');

	const navItems = [
		{ label: 'Home', path: 'M3 19h-6v2h6v-2zM3 5v2h14V5H3zm0 8h10v-2H3v2z', active: true },
		{ label: 'Search', path: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z', active: false },
		{ label: 'Library', path: 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z', active: false },
		{ label: 'Profile', path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z', active: false },
	];

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
			onclick={() => activeTab = 'preview'}
			class="flex items-center gap-1.5 px-4 py-3 font-body text-[13px] font-500 cursor-pointer transition-all duration-200 relative"
			style="color: {activeTab === 'preview' ? 'var(--text-primary)' : 'var(--text-tertiary)'}"
		>
			Preview
			{#if activeTab === 'preview'}
				<div class="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style="background: var(--text-primary)"></div>
			{/if}
		</button>
		<button
			onclick={() => activeTab = 'cvd'}
			class="flex items-center gap-1.5 px-4 py-3 font-body text-[13px] font-500 cursor-pointer transition-all duration-200 relative"
			style="color: {activeTab === 'cvd' ? 'var(--text-primary)' : 'var(--text-tertiary)'}"
		>
			Colour Blindness
			{#if activeTab === 'cvd'}
				<div class="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style="background: var(--text-primary)"></div>
			{/if}
		</button>
		<div class="flex-1"></div>
		<span class="font-body text-[11px]" style="color: var(--text-ghost)">
			{#if activeTab === 'preview'}Material 3 Expressive-inspired components{:else}
				<span title="Simulates how your palette appears to people with colour vision deficiencies (protanopia, deuteranopia, tritanopia)">Colour blindness simulation model</span>
			{/if}
		</span>
	</div>

	<!-- Preview tab -->
	{#if activeTab === 'preview'}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-0">
			<!-- Light Mode -->
			<div class="p-5 space-y-5" style="background: #FFFFFF">
				<span class="block font-mono text-[10px] uppercase tracking-wide" style="color: {GREY_750_69}">Light Mode</span>

				<!-- Buttons (M3 Expressive style — pill shapes, bold) -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_750_69}">Buttons</span>
					<div class="flex flex-wrap items-center gap-2">
						<button
							class="px-5 py-2.5 font-body text-[13px] font-600"
							style="background: {s300}; color: {GREY_50}; cursor: default; border-radius: 100px"
						>Primary</button>
						<button
							class="px-5 py-2.5 font-body text-[13px] font-600"
							style="background: {s50}; color: {s300}; cursor: default; border-radius: 100px"
						>Tonal</button>
						<button
							class="px-5 py-2.5 font-body text-[13px] font-600"
							style="background: transparent; color: {s300}; border: 1.5px solid {s100}; cursor: default; border-radius: 100px"
						>Outlined</button>
						<button
							class="px-5 py-2.5 font-body text-[13px] font-500 opacity-35"
							style="background: {s100}; color: {GREY_750}; cursor: not-allowed; border-radius: 100px"
						>Disabled</button>
					</div>
				</div>

				<!-- FAB (M3 Expressive — large rounded, elevated) -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_750_69}">Floating Action Button</span>
					<div class="flex items-center gap-3">
						<div
							class="w-14 h-14 flex items-center justify-center"
							style="background: {s100}; border-radius: 16px; box-shadow: 0 3px 8px rgba(0,0,0,0.12)"
						>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
								<path d="M12 5v14M5 12h14" stroke="{s300}" stroke-width="2.5" stroke-linecap="round"/>
							</svg>
						</div>
						<div
							class="h-14 flex items-center gap-2.5 px-5"
							style="background: {s100}; border-radius: 16px; box-shadow: 0 3px 8px rgba(0,0,0,0.12)"
						>
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
								<path d="M12 5v14M5 12h14" stroke="{s300}" stroke-width="2.5" stroke-linecap="round"/>
							</svg>
							<span class="font-body text-[14px] font-600" style="color: {s300}">New item</span>
						</div>
					</div>
				</div>

				<!-- Chips (M3 — pill shape, tonal + outlined) -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_750_69}">Chips</span>
					<div class="flex flex-wrap items-center gap-2">
						<span class="inline-flex items-center gap-1.5 px-3.5 py-1.5 font-body text-[12px] font-500"
							style="background: {s100}; color: {GREY_750}; border-radius: 100px"
						>
							<span class="w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[10px]" style="background: {s300}; color: {GREY_50}">✓</span>
							Selected
						</span>
						<span class="inline-flex items-center px-3.5 py-1.5 font-body text-[12px] font-500"
							style="background: transparent; color: {GREY_750}; border: 1px solid {s100}; border-radius: 100px"
						>Filter</span>
						<span class="inline-flex items-center px-3.5 py-1.5 font-body text-[12px] font-500"
							style="background: transparent; color: {GREY_750}; border: 1px solid {s100}; border-radius: 100px"
						>Category</span>
						<span class="inline-flex items-center gap-1 px-3.5 py-1.5 font-body text-[12px] font-500"
							style="background: {s50}; color: {s300}; border-radius: 100px"
						>
							Assist
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
								<path d="M9 18l6-6-6-6" stroke="{s300}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</span>
					</div>
				</div>

				<!-- Segmented Button (M3 Expressive) -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_750_69}">Segmented Button</span>
					<div class="inline-flex" style="border: 1.5px solid {s100}; border-radius: 100px; overflow: hidden">
						<span class="px-4 py-2 font-body text-[12px] font-600" style="background: {s100}; color: {s300}">Day</span>
						<span class="px-4 py-2 font-body text-[12px] font-500" style="background: transparent; color: {GREY_750}; border-left: 1.5px solid {s100}">Week</span>
						<span class="px-4 py-2 font-body text-[12px] font-500" style="background: transparent; color: {GREY_750}; border-left: 1.5px solid {s100}">Month</span>
					</div>
				</div>

				<!-- Form Input -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_750_69}">Text Field</span>
					<div class="flex flex-col gap-1.5">
						<div
							class="flex items-center px-4 py-3"
							style="border: 1.5px solid {s300}; border-radius: 12px; background: #FFFFFF"
						>
							<span class="font-body text-[13px]" style="color: {GREY_750}">user@example.com</span>
						</div>
						<span class="font-body text-[11px] pl-1" style="color: {GREY_750_69}">Supporting text · Shade 300 focus border</span>
					</div>
				</div>

				<!-- Card (M3 — elevated, rounded 28px) -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_750_69}">Card</span>
					<div style="border-radius: 28px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)">
						<div class="px-5 py-4" style="background: {s300}">
							<span class="font-body text-[15px] font-600" style="color: {GREY_50}">Card headline</span>
							<span class="block font-body text-[12px] mt-0.5" style="color: {GREY_50}; opacity: 0.8">Shade 300 header</span>
						</div>
						<div class="px-5 py-4" style="background: {s50}">
							<span class="font-body text-[13px]" style="color: {GREY_750}">Body content using shade 50 surface with primary text.</span>
						</div>
						<div class="flex items-center gap-2 px-5 py-3" style="background: #FFFFFF; border-top: 1px solid rgba(0,0,0,0.05)">
							<button class="px-4 py-1.5 font-body text-[12px] font-600" style="color: {s300}; cursor: default; border-radius: 100px">Action</button>
							<button class="px-4 py-1.5 font-body text-[12px] font-500" style="color: {GREY_750_69}; cursor: default; border-radius: 100px">Dismiss</button>
						</div>
					</div>
				</div>

				<!-- Navigation Bar (M3 — bottom nav with indicator) -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_750_69}">Navigation Bar</span>
					<div class="flex items-center" style="background: {s50}; border-radius: 16px; padding: 6px 8px">
					{#each navItems as item}
						<div class="flex-1 flex flex-col items-center gap-0.5 py-1.5 px-2" style="cursor: default">
							<div class="w-16 h-8 flex items-center justify-center" style="background: {item.active ? s100 : 'transparent'}; border-radius: 100px; transition: background 0.2s">
								<svg width="20" height="20" viewBox="0 0 24 24" fill="{item.active ? s300 : GREY_750_69}"><path d="{item.path}"/></svg>
							</div>
							<span class="font-body text-[10px]" style="color: {item.active ? s300 : GREY_750_69}; font-weight: {item.active ? 600 : 400}">{item.label}</span>
						</div>
					{/each}
					</div>
				</div>

				<!-- Switch / Toggle -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_750_69}">Switch</span>
					<div class="flex items-center gap-4">
						<div class="relative" style="width: 52px; height: 32px; cursor: default">
							<div class="absolute inset-0" style="background: {s300}; border-radius: 100px"></div>
							<div class="absolute top-[4px] left-[24px] w-6 h-6 rounded-full" style="background: {GREY_50}; box-shadow: 0 1px 3px rgba(0,0,0,0.2)"></div>
						</div>
						<span class="font-body text-[12px]" style="color: {GREY_750}">Enabled</span>
						<div class="relative" style="width: 52px; height: 32px; cursor: default">
							<div class="absolute inset-0" style="background: {s100}; border-radius: 100px; border: 2px solid {GREY_750_69}"></div>
							<div class="absolute top-[6px] left-[6px] w-5 h-5 rounded-full" style="background: {GREY_750_69}"></div>
						</div>
						<span class="font-body text-[12px]" style="color: {GREY_750}">Disabled</span>
					</div>
				</div>

				<!-- Progress Indicator -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_750_69}">Progress</span>
					<div class="space-y-2">
						<div class="h-1 w-full" style="background: {s50}; border-radius: 100px; overflow: hidden">
							<div class="h-full" style="width: 65%; background: {s300}; border-radius: 100px"></div>
						</div>
						<div class="flex items-center justify-between">
							<span class="font-body text-[11px]" style="color: {GREY_750}">Uploading...</span>
							<span class="font-body text-[11px] font-500" style="color: {s300}">65%</span>
						</div>
					</div>
				</div>

				<!-- Snackbar / Toast -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_750_69}">Snackbar</span>
					<div class="flex items-center gap-3 px-4 py-3" style="background: {GREY_750}; border-radius: 12px">
						<span class="flex-1 font-body text-[13px]" style="color: {GREY_50}">File uploaded successfully</span>
						<button class="font-body text-[12px] font-600 px-2" style="color: {s100}; cursor: default">Undo</button>
					</div>
				</div>

				<!-- List Item -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_750_69}">List</span>
					<div style="border-radius: 16px; overflow: hidden; border: 1px solid rgba(0,0,0,0.06)">
						<div class="flex items-center gap-3 px-4 py-3" style="background: {s50}">
							<div class="w-10 h-10 rounded-full flex items-center justify-center font-body text-[14px] font-600" style="background: {s300}; color: {GREY_50}">A</div>
							<div class="flex-1">
								<span class="block font-body text-[13px] font-500" style="color: {GREY_750}">Selected item</span>
								<span class="block font-body text-[11px]" style="color: {GREY_750_69}">Supporting text</span>
							</div>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="{s300}"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
						</div>
						<div class="flex items-center gap-3 px-4 py-3" style="background: #FFFFFF">
							<div class="w-10 h-10 rounded-full flex items-center justify-center font-body text-[14px] font-600" style="background: {s100}; color: {GREY_750}">B</div>
							<div class="flex-1">
								<span class="block font-body text-[13px] font-500" style="color: {GREY_750}">Default item</span>
								<span class="block font-body text-[11px]" style="color: {GREY_750_69}">Supporting text</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Dark Mode -->
			<div class="p-5 space-y-5" style="background: #111113; border-left: 1px solid var(--border-subtle)">
				<span class="block font-mono text-[10px] uppercase tracking-wide" style="color: {GREY_50_72}">Dark Mode</span>

				<!-- Buttons -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_50_72}">Buttons</span>
					<div class="flex flex-wrap items-center gap-2">
						<button
							class="px-5 py-2.5 font-body text-[13px] font-600"
							style="background: {s200}; color: {GREY_750}; cursor: default; border-radius: 100px"
						>Primary</button>
						<button
							class="px-5 py-2.5 font-body text-[13px] font-600"
							style="background: {s500}; color: {s200}; cursor: default; border-radius: 100px"
						>Tonal</button>
						<button
							class="px-5 py-2.5 font-body text-[13px] font-600"
							style="background: transparent; color: {s200}; border: 1.5px solid {s400}; cursor: default; border-radius: 100px"
						>Outlined</button>
						<button
							class="px-5 py-2.5 font-body text-[13px] font-500 opacity-35"
							style="background: {s400}; color: {GREY_50}; cursor: not-allowed; border-radius: 100px"
						>Disabled</button>
					</div>
				</div>

				<!-- FAB -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_50_72}">Floating Action Button</span>
					<div class="flex items-center gap-3">
						<div
							class="w-14 h-14 flex items-center justify-center"
							style="background: {s400}; border-radius: 16px; box-shadow: 0 3px 8px rgba(0,0,0,0.3)"
						>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
								<path d="M12 5v14M5 12h14" stroke="{s200}" stroke-width="2.5" stroke-linecap="round"/>
							</svg>
						</div>
						<div
							class="h-14 flex items-center gap-2.5 px-5"
							style="background: {s400}; border-radius: 16px; box-shadow: 0 3px 8px rgba(0,0,0,0.3)"
						>
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
								<path d="M12 5v14M5 12h14" stroke="{s200}" stroke-width="2.5" stroke-linecap="round"/>
							</svg>
							<span class="font-body text-[14px] font-600" style="color: {s200}">New item</span>
						</div>
					</div>
				</div>

				<!-- Chips -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_50_72}">Chips</span>
					<div class="flex flex-wrap items-center gap-2">
						<span class="inline-flex items-center gap-1.5 px-3.5 py-1.5 font-body text-[12px] font-500"
							style="background: {s400}; color: {GREY_50}; border-radius: 100px"
						>
							<span class="w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[10px]" style="background: {s200}; color: {GREY_750}">✓</span>
							Selected
						</span>
						<span class="inline-flex items-center px-3.5 py-1.5 font-body text-[12px] font-500"
							style="background: transparent; color: {GREY_50}; border: 1px solid {s400}; border-radius: 100px"
						>Filter</span>
						<span class="inline-flex items-center px-3.5 py-1.5 font-body text-[12px] font-500"
							style="background: transparent; color: {GREY_50}; border: 1px solid {s400}; border-radius: 100px"
						>Category</span>
						<span class="inline-flex items-center gap-1 px-3.5 py-1.5 font-body text-[12px] font-500"
							style="background: {s500}; color: {s200}; border-radius: 100px"
						>
							Assist
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
								<path d="M9 18l6-6-6-6" stroke="{s200}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</span>
					</div>
				</div>

				<!-- Segmented Button -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_50_72}">Segmented Button</span>
					<div class="inline-flex" style="border: 1.5px solid {s400}; border-radius: 100px; overflow: hidden">
						<span class="px-4 py-2 font-body text-[12px] font-600" style="background: {s400}; color: {s200}">Day</span>
						<span class="px-4 py-2 font-body text-[12px] font-500" style="background: transparent; color: {GREY_50}; border-left: 1.5px solid {s400}">Week</span>
						<span class="px-4 py-2 font-body text-[12px] font-500" style="background: transparent; color: {GREY_50}; border-left: 1.5px solid {s400}">Month</span>
					</div>
				</div>

				<!-- Form Input -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_50_72}">Text Field</span>
					<div class="flex flex-col gap-1.5">
						<div
							class="flex items-center px-4 py-3"
							style="border: 1.5px solid {s200}; border-radius: 12px; background: #111113"
						>
							<span class="font-body text-[13px]" style="color: {GREY_50}">user@example.com</span>
						</div>
						<span class="font-body text-[11px] pl-1" style="color: {GREY_50_72}">Supporting text · Shade 200 focus border</span>
					</div>
				</div>

				<!-- Card -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_50_72}">Card</span>
					<div style="border-radius: 28px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.3)">
						<div class="px-5 py-4" style="background: {s200}">
							<span class="font-body text-[15px] font-600" style="color: {GREY_750}">Card headline</span>
							<span class="block font-body text-[12px] mt-0.5" style="color: {GREY_750}; opacity: 0.7">Shade 200 header</span>
						</div>
						<div class="px-5 py-4" style="background: {s500}">
							<span class="font-body text-[13px]" style="color: {GREY_50}">Body content using shade 500 surface with primary text.</span>
						</div>
						<div class="flex items-center gap-2 px-5 py-3" style="background: #111113; border-top: 1px solid rgba(255,255,255,0.05)">
							<button class="px-4 py-1.5 font-body text-[12px] font-600" style="color: {s200}; cursor: default; border-radius: 100px">Action</button>
							<button class="px-4 py-1.5 font-body text-[12px] font-500" style="color: {GREY_50_72}; cursor: default; border-radius: 100px">Dismiss</button>
						</div>
					</div>
				</div>

				<!-- Navigation Bar -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_50_72}">Navigation Bar</span>
					<div class="flex items-center" style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 6px 8px">
					{#each navItems as item}
						<div class="flex-1 flex flex-col items-center gap-0.5 py-1.5 px-2" style="cursor: default">
							<div class="w-16 h-8 flex items-center justify-center" style="background: {item.active ? s400 : 'transparent'}; border-radius: 100px; transition: background 0.2s">
								<svg width="20" height="20" viewBox="0 0 24 24" fill="{item.active ? s200 : GREY_50_72}"><path d="{item.path}"/></svg>
							</div>
							<span class="font-body text-[10px]" style="color: {item.active ? s200 : GREY_50_72}; font-weight: {item.active ? 600 : 400}">{item.label}</span>
						</div>
					{/each}
					</div>
				</div>

				<!-- Switch -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_50_72}">Switch</span>
					<div class="flex items-center gap-4">
						<div class="relative" style="width: 52px; height: 32px; cursor: default">
							<div class="absolute inset-0" style="background: {s200}; border-radius: 100px"></div>
							<div class="absolute top-[4px] left-[24px] w-6 h-6 rounded-full" style="background: {GREY_750}; box-shadow: 0 1px 3px rgba(0,0,0,0.3)"></div>
						</div>
						<span class="font-body text-[12px]" style="color: {GREY_50}">Enabled</span>
						<div class="relative" style="width: 52px; height: 32px; cursor: default">
							<div class="absolute inset-0" style="background: transparent; border-radius: 100px; border: 2px solid {GREY_50_72}"></div>
							<div class="absolute top-[6px] left-[6px] w-5 h-5 rounded-full" style="background: {GREY_50_72}"></div>
						</div>
						<span class="font-body text-[12px]" style="color: {GREY_50}">Disabled</span>
					</div>
				</div>

				<!-- Progress -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_50_72}">Progress</span>
					<div class="space-y-2">
						<div class="h-1 w-full" style="background: {s500}; border-radius: 100px; overflow: hidden">
							<div class="h-full" style="width: 65%; background: {s200}; border-radius: 100px"></div>
						</div>
						<div class="flex items-center justify-between">
							<span class="font-body text-[11px]" style="color: {GREY_50}">Uploading...</span>
							<span class="font-body text-[11px] font-500" style="color: {s200}">65%</span>
						</div>
					</div>
				</div>

				<!-- Snackbar -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_50_72}">Snackbar</span>
					<div class="flex items-center gap-3 px-4 py-3" style="background: rgba(255,255,255,0.12); border-radius: 12px">
						<span class="flex-1 font-body text-[13px]" style="color: {GREY_50}">File uploaded successfully</span>
						<button class="font-body text-[12px] font-600 px-2" style="color: {s200}; cursor: default">Undo</button>
					</div>
				</div>

				<!-- List Item -->
				<div class="space-y-2">
					<span class="block font-mono text-[9px] uppercase tracking-wider mb-1.5" style="color: {GREY_50_72}">List</span>
					<div style="border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06)">
						<div class="flex items-center gap-3 px-4 py-3" style="background: {s500}">
							<div class="w-10 h-10 rounded-full flex items-center justify-center font-body text-[14px] font-600" style="background: {s200}; color: {GREY_750}">A</div>
							<div class="flex-1">
								<span class="block font-body text-[13px] font-500" style="color: {GREY_50}">Selected item</span>
								<span class="block font-body text-[11px]" style="color: {GREY_50_72}">Supporting text</span>
							</div>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="{s200}"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
						</div>
						<div class="flex items-center gap-3 px-4 py-3" style="background: #111113">
							<div class="w-10 h-10 rounded-full flex items-center justify-center font-body text-[14px] font-600" style="background: {s400}; color: {GREY_50}">B</div>
							<div class="flex-1">
								<span class="block font-body text-[13px] font-500" style="color: {GREY_50}">Default item</span>
								<span class="block font-body text-[11px]" style="color: {GREY_50_72}">Supporting text</span>
							</div>
						</div>
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
