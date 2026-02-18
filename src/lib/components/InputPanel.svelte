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

<div class="space-y-3">
	<p class="font-display text-[12px] font-600 uppercase tracking-[0.10em]" style="color: var(--text-secondary)">
		Anchor Colour (300 Shade)
	</p>
	<p class="text-[11px] font-body leading-relaxed" style="color: var(--text-ghost)">
		The base colour from which all 6 shades will be generated.
	</p>

	<!-- Hex + Name in a single row -->
	<div class="flex gap-2.5 items-start">
		<!-- Hex input -->
		<div class="relative flex-1 min-w-0">
			<label for="hex-input" class="block text-[10px] font-body font-500 mb-1" style="color: var(--text-ghost)">Hex</label>
			<div class="relative">
				<input
					id="hex-input"
					type="text"
					bind:value={rawHex}
					oninput={handleHexInput}
					placeholder="#7E42EB"
					class="w-full rounded-lg pl-3 pr-12 py-2.5 font-mono text-[13px] font-500 transition-all duration-200
						placeholder:opacity-30 focus:outline-none focus-visible:outline-1 focus-visible:outline-white/30 focus-visible:outline-offset-2"
					style="
						background: var(--surface-2);
						border: 1px solid {isValid || !rawHex ? 'var(--border-medium)' : 'rgba(239,68,68,0.5)'};
						color: var(--text-primary);
					"
					spellcheck="false"
					autocomplete="off"
				/>
				<label
					class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md cursor-pointer ring-1 ring-white/10 transition-all duration-200 hover:ring-white/25 hover:scale-105"
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
			{#if !isValid && rawHex}
				<p class="text-[11px] font-body mt-1" style="color: rgba(239,68,68,0.8)">
					Invalid hex
				</p>
			{/if}
		</div>

		<!-- Family name -->
		<div class="w-[110px] shrink-0">
			<label for="name-input" class="block text-[10px] font-body font-500 mb-1" style="color: var(--text-ghost)">Name</label>
			<input
				id="name-input"
				type="text"
				bind:value={colorName}
				oninput={handleNameInput}
				placeholder="Custom"
				class="w-full rounded-lg px-3 py-2.5 font-body text-[13px] transition-all duration-200
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
</div>
