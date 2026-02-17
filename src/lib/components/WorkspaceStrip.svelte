<script lang="ts">
	import type { ScaleResult } from '$lib/scale';

	let {
		scale,
		onEdit,
		onRemove
	}: {
		scale: ScaleResult;
		onEdit: (scale: ScaleResult) => void;
		onRemove: (scale: ScaleResult) => void;
	} = $props();
</script>

<div
	class="flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group"
	style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
>
	<!-- Color swatch + name -->
	<div class="flex items-center gap-3 w-32 shrink-0">
		<div
			class="w-5 h-5 rounded-md ring-1 ring-white/10"
			style="background-color: {scale.shades[2]?.hex ?? scale.inputHex}"
		></div>
		<span
			class="text-[14px] font-body font-500 truncate"
			style="color: var(--text-primary)"
			title="{scale.name} — {scale.shades.length} shades, Hue {scale.hue.toFixed(1)}°"
		>
			{scale.name}
		</span>
	</div>

	<!-- Color strip -->
	<div class="flex gap-[3px] flex-1">
		{#each scale.shades as shade (shade.shade)}
			<div
				class="h-10 flex-1 first:rounded-l-lg last:rounded-r-lg transition-transform duration-200 group-hover:scale-y-110"
				style="background-color: {shade.hex}"
				title="{scale.name}/{shade.shade}: {shade.hex}"
			></div>
		{/each}
	</div>

	<!-- Action buttons -->
	<div class="flex gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
		<button
			onclick={() => onEdit(scale)}
			class="text-[12px] font-body font-500 px-3 py-1.5 rounded-lg transition-colors duration-200 cursor-pointer"
			style="background: var(--surface-2); border: 1px solid var(--border-medium); color: var(--text-secondary)"
			title="Load back into the generator for editing"
		>
			Edit
		</button>
		<button
			onclick={() => onRemove(scale)}
			class="text-[12px] font-body font-500 px-3 py-1.5 rounded-lg transition-colors duration-200 cursor-pointer"
			style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: rgba(239,68,68,0.8)"
			title="Remove this family from saved scales"
		>
			Remove
		</button>
	</div>
</div>
