<script lang="ts">
	import type { ScaleResult } from '$lib/scale';
	import { SHADE_LEVELS } from '$lib/constants';
	import { hexToRgb, relativeLuminance } from '$lib/colour';

	let {
		scaleA,
		scaleB,
		onClose
	}: {
		scaleA: ScaleResult;
		scaleB: ScaleResult;
		onClose?: () => void;
	} = $props();

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
			// noop
		}
	}

	function delta(a: number, b: number): string {
		const d = b - a;
		return d >= 0 ? `+${d.toFixed(3)}` : d.toFixed(3);
	}

	function hueDelta(a: number, b: number): number {
		const d = Math.abs(a - b) % 360;
		return d > 180 ? 360 - d : d;
	}

	function hexDelta(hexA: string, hexB: string): number {
		const parse = (h: string) => {
			const v = h.replace('#', '');
			return [
				parseInt(v.slice(0, 2), 16),
				parseInt(v.slice(2, 4), 16),
				parseInt(v.slice(4, 6), 16)
			];
		};
		const [rA, gA, bA] = parse(hexA);
		const [rB, gB, bB] = parse(hexB);
		return Math.max(Math.abs(rA - rB), Math.abs(gA - gB), Math.abs(bA - bB));
	}
</script>

<div
	class="rounded-2xl overflow-hidden fade-in"
	style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
>
	<!-- Header -->
	<div class="flex items-center justify-between px-5 py-3.5" style="border-bottom: 1px solid var(--border-subtle)">
		<div class="flex items-center gap-3">
			<p class="font-display text-[13px] font-600" style="color: var(--text-primary)">Comparing Scales</p>
			<div class="flex items-center gap-2">
				<div class="flex items-center gap-1.5">
					<div class="w-4 h-4 rounded-md ring-1 ring-white/10" style="background-color: {scaleA.shades[3]?.hex ?? scaleA.inputHex}"></div>
					<span class="font-body text-[13px] font-500" style="color: var(--text-primary)">{scaleA.name}</span>
				</div>
				<span class="font-mono text-[11px]" style="color: var(--text-ghost)">vs</span>
				<div class="flex items-center gap-1.5">
					<div class="w-4 h-4 rounded-md ring-1 ring-white/10" style="background-color: {scaleB.shades[3]?.hex ?? scaleB.inputHex}"></div>
					<span class="font-body text-[13px] font-500" style="color: var(--text-primary)">{scaleB.name}</span>
				</div>
			</div>
		</div>
		{#if onClose}
			<button
				onclick={onClose}
				class="font-body text-[12px] font-500 px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-200 hover:opacity-80"
				style="background: rgba(255,255,255,0.06); color: var(--text-tertiary)"
			>
				Exit comparison
			</button>
		{/if}
	</div>

	<!-- Summary -->
	<div class="flex flex-wrap gap-4 px-5 py-3" style="border-bottom: 1px solid var(--border-subtle); background: var(--surface-2)">
		<div class="flex items-baseline gap-2">
			<span class="font-body text-[12px]" style="color: var(--text-tertiary)">Hue difference:</span>
			<span class="font-mono text-[13px] font-500" style="color: var(--text-primary)">{hueDelta(scaleA.hue, scaleB.hue).toFixed(1)}°</span>
		</div>
		<div class="w-px h-4 self-center" style="background: var(--border-medium)"></div>
		<div class="flex items-baseline gap-2">
			<span class="font-body text-[12px]" style="color: var(--text-tertiary)">Max hex delta:</span>
			<span class="font-mono text-[13px] font-500" style="color: var(--text-primary)">
				{Math.max(...SHADE_LEVELS.map((_, i) => hexDelta(scaleA.shades[i]?.hex ?? '#000', scaleB.shades[i]?.hex ?? '#000')))}
			</span>
		</div>
	</div>

	<!-- Per-shade comparison (row-oriented grid) -->
	<div class="px-5 py-4">
		<div class="grid gap-x-2 gap-y-1.5" style="grid-template-columns: 72px repeat(6, 1fr)">
			<!-- Shade number header row -->
			<div></div>
			{#each SHADE_LEVELS as level (level)}
				<span class="block font-mono text-[11px] font-600 text-center" style="color: var(--text-secondary)">{level}</span>
			{/each}

			<!-- Scale A row -->
			<div class="flex items-center">
				<div class="flex items-center gap-1.5">
					<div class="w-3 h-3 rounded-sm ring-1 ring-white/10" style="background-color: {scaleA.shades[3]?.hex ?? scaleA.inputHex}"></div>
					<span class="font-body text-[11px] font-500 truncate" style="color: var(--text-tertiary)">{scaleA.name}</span>
				</div>
			</div>
			{#each SHADE_LEVELS as level, i (level)}
				{@const sh = scaleA.shades[i]}
				{#if sh}
					{@const key = `a-${level}`}
					<button
						class="relative h-12 rounded-lg ring-1 ring-white/5 flex items-center justify-center cursor-pointer transition-all hover:ring-2 hover:ring-white/20 active:scale-[0.97]"
						style="background-color: {sh.hex}"
						title="Click to copy {sh.hex}"
						onclick={() => copyHex(sh.hex, key)}
					>
						<span
							class="font-mono text-[9px] font-500 transition-opacity"
							style="color: {swatchTextColor(sh.hex)}"
						>{copiedKey === key ? 'Copied!' : sh.hex}</span>
					</button>
				{/if}
			{/each}

			<!-- Scale B row -->
			<div class="flex items-center">
				<div class="flex items-center gap-1.5">
					<div class="w-3 h-3 rounded-sm ring-1 ring-white/10" style="background-color: {scaleB.shades[3]?.hex ?? scaleB.inputHex}"></div>
					<span class="font-body text-[11px] font-500 truncate" style="color: var(--text-tertiary)">{scaleB.name}</span>
				</div>
			</div>
			{#each SHADE_LEVELS as level, i (level)}
				{@const sh = scaleB.shades[i]}
				{#if sh}
					{@const key = `b-${level}`}
					<button
						class="relative h-12 rounded-lg ring-1 ring-white/5 flex items-center justify-center cursor-pointer transition-all hover:ring-2 hover:ring-white/20 active:scale-[0.97]"
						style="background-color: {sh.hex}"
						title="Click to copy {sh.hex}"
						onclick={() => copyHex(sh.hex, key)}
					>
						<span
							class="font-mono text-[9px] font-500 transition-opacity"
							style="color: {swatchTextColor(sh.hex)}"
						>{copiedKey === key ? 'Copied!' : sh.hex}</span>
					</button>
				{/if}
			{/each}

			<!-- Delta row -->
			<div></div>
			{#each SHADE_LEVELS as level, i (level)}
				{@const shA = scaleA.shades[i]}
				{@const shB = scaleB.shades[i]}
				{#if shA && shB}
					{@const hd = hexDelta(shA.hex, shB.hex)}
					<div class="space-y-0.5 text-center">
						<span
							class="block font-mono text-[10px] font-500"
							style="color: {hd > 40 ? '#ef4444' : hd > 20 ? '#f59e0b' : 'var(--text-ghost)'}"
						>
							Δ{hd}
						</span>
						<span class="block font-mono text-[9px]" style="color: var(--text-ghost)">
							L {delta(shA.oklch.L, shB.oklch.L)}
						</span>
						<span class="block font-mono text-[9px]" style="color: var(--text-ghost)">
							C {delta(shA.oklch.C, shB.oklch.C)}
						</span>
					</div>
				{/if}
			{/each}
		</div>

		<!-- Footer legend -->
		<div class="flex items-center gap-3 mt-3 pt-3" style="border-top: 1px solid var(--border-subtle)">
			<span class="font-body text-[11px]" style="color: var(--text-ghost)">ΔL = lightness · ΔC = chroma · Click swatches to copy hex</span>
		</div>
	</div>
</div>
