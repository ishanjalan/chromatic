<script lang="ts">
	import { isValidHex, normalizeHex } from '$lib/colour';

	let {
		hexValue = $bindable(''),
		colorName = $bindable('Custom'),
		onChange
	}: {
		hexValue: string;
		colorName: string;
		onChange: (data: { hex: string; name: string }) => void;
	} = $props();

	let rawHex = $state(hexValue);
	let isValid = $derived(isValidHex(rawHex));

	function handleHexInput() {
		if (isValid) {
			hexValue = normalizeHex(rawHex);
			onChange({ hex: hexValue, name: colorName });
		}
	}

	function handleNameInput() {
		if (isValid) {
			onChange({ hex: hexValue, name: colorName });
		}
	}

	function handlePickerChange(e: Event) {
		const target = e.target as HTMLInputElement;
		rawHex = target.value;
		hexValue = normalizeHex(rawHex);
		onChange({ hex: hexValue, name: colorName });
	}

	export function setHex(hex: string) {
		rawHex = hex;
		hexValue = normalizeHex(hex);
		onChange({ hex: hexValue, name: colorName });
	}
</script>

<div class="space-y-5">
	<!-- Hex input -->
	<div>
		<label
			for="hex-input"
			class="block font-display text-[12px] font-600 uppercase tracking-[0.10em] mb-1.5"
			style="color: var(--text-secondary)"
		>
			Anchor Colour (300 Shade)
		</label>
		<p class="text-[12px] font-body mb-2" style="color: var(--text-tertiary)">
			The base colour from which all 6 shades will be generated.
		</p>
		<div class="flex gap-2.5 items-center">
			<div class="relative flex-1">
				<input
					id="hex-input"
					type="text"
					bind:value={rawHex}
					oninput={handleHexInput}
					placeholder="#7E42EB"
					class="w-full rounded-xl pl-3.5 pr-14 py-3 font-mono text-sm font-500 transition-all duration-200
						placeholder:opacity-30 focus:outline-none focus-visible:outline-1 focus-visible:outline-white/30 focus-visible:outline-offset-2"
					style="
						background: var(--surface-2);
						border: 1px solid {isValid || !rawHex ? 'var(--border-medium)' : 'rgba(239,68,68,0.5)'};
						color: var(--text-primary);
					"
					spellcheck="false"
					autocomplete="off"
				/>
				<!-- Unified swatch + picker -->
				<label
					class="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg cursor-pointer ring-1 ring-white/10 transition-all duration-200 hover:ring-white/25 hover:scale-105"
					style="background-color: {isValid && rawHex ? normalizeHex(rawHex) : 'var(--surface-3)'}"
					title="Click to open colour picker"
				>
					<input
						type="color"
						value={isValid && rawHex ? normalizeHex(rawHex) : '#7E42EB'}
						oninput={handlePickerChange}
						class="sr-only"
					/>
				</label>
			</div>
		</div>
		{#if !isValid && rawHex}
			<p class="text-[12px] font-body mt-1.5" style="color: rgba(239,68,68,0.8)">
				Enter a valid 6-character hex (e.g. #7E42EB)
			</p>
		{/if}
	</div>

	<!-- Color Name -->
	<div>
		<label
			for="name-input"
			class="block font-display text-[12px] font-600 uppercase tracking-[0.10em] mb-1.5"
			style="color: var(--text-secondary)"
		>
			Family Name
		</label>
		<p class="text-[12px] font-body mb-2" style="color: var(--text-tertiary)">
			Used as the token name for this family (e.g. "Coral/300").
		</p>
		<input
			id="name-input"
			type="text"
			bind:value={colorName}
			oninput={handleNameInput}
			placeholder="Custom"
			class="w-full rounded-xl px-3.5 py-3 font-body text-sm transition-all duration-200
				placeholder:opacity-30 focus:outline-none focus-visible:outline-1 focus-visible:outline-white/30 focus-visible:outline-offset-2"
			style="
				background: var(--surface-2);
				border: 1px solid var(--border-medium);
				color: var(--text-primary);
			"
			spellcheck="false"
		/>
	</div>
</div>
