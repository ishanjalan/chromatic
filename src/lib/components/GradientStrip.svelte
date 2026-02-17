<script lang="ts">
	/**
	 * GradientStrip — continuous colour ramp from a list of hex values.
	 * Reveals uneven perceptual jumps that discrete swatches can hide.
	 */

	let {
		hexes,
		height = 12,
		label = ''
	}: {
		hexes: string[];
		height?: number;
		label?: string;
	} = $props();

	let gradient = $derived(
		hexes.length >= 2
			? `linear-gradient(to right, ${hexes.join(', ')})`
			: hexes[0] ?? 'transparent'
	);
</script>

<div class="flex items-center gap-2">
	{#if label}
		<span
			class="shrink-0 font-body text-[10px] font-500 w-[60px] text-right"
			style="color: var(--text-ghost)"
		>{label}</span>
	{/if}
	<div
		class="flex-1 rounded-md"
		style="height: {height}px; background: {gradient}; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06)"
		title={hexes.join(' → ')}
	></div>
</div>
