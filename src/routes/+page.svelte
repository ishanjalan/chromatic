<script lang="ts">
	import { onMount } from 'svelte';
	import { generateScale } from '$lib/scale';
	import type { ScaleResult } from '$lib/scale';
	import { isValidHex } from '$lib/colour';
	import { findClosestTailwind } from '$lib/tailwind-match';
	import { parseTokenJson } from '$lib/parse-tokens';
	import type { ParsedFamily } from '$lib/parse-tokens';
	import { runPaletteAudit } from '$lib/palette-audit';
	import type { PaletteAudit } from '$lib/palette-audit';
	import { saveWorkspace, loadWorkspace, saveTokenJson, loadTokenJson, clearTokenJson, saveLocked300, loadLocked300 } from '$lib/persistence';
	import { ColourHistory } from '$lib/history';
	import { encodeShareState, decodeShareState, buildShareUrl } from '$lib/share';
	import HueWheel from '$lib/components/HueWheel.svelte';
	import ShadeCard from '$lib/components/ShadeCard.svelte';
	import InputPanel from '$lib/components/InputPanel.svelte';
	import WorkspaceStrip from '$lib/components/WorkspaceStrip.svelte';
	import ComparisonView from '$lib/components/ComparisonView.svelte';
	import PaletteAuditPanel from '$lib/components/PaletteAudit.svelte';
	import ScaleComparison from '$lib/components/ScaleComparison.svelte';
	import ScalePreview from '$lib/components/ScalePreview.svelte';

	let hexValue = $state('');
	let colorName = $state('Custom');
	let currentScale = $state<ScaleResult | null>(null);
	let workspace = $state<ScaleResult[]>([]);
	let inputPanel: InputPanel | undefined = $state();
	let scaleKey = $state(0);

	// Undo/redo history
	const colourHistory = new ColourHistory();
	let canGoBack = $state(false);
	let canGoForward = $state(false);
	let isHistoryNavigation = false;

	// Comparison mode state
	let comparisonFamilies = $state<ParsedFamily[]>([]);
	let comparisonErrors = $state<string[]>([]);
	let comparisonJsonInput = $state('');
	let isDragging = $state(false);

	// Locked 300 shades — per-family override to preserve the original 300 hex
	let lockedFamilies = $state<Set<string>>(new Set());

	function handleToggleLock(familyName: string) {
		const next = new Set(lockedFamilies);
		if (next.has(familyName)) next.delete(familyName);
		else next.add(familyName);
		lockedFamilies = next;
		saveLocked300(next);
	}

	// Scale comparison mode
	let compareMode = $state(false);
	let compareSelections = $state<string[]>([]);
	let compareScaleA = $derived(compareSelections.length >= 1 ? workspace.find((s) => s.name === compareSelections[0]) ?? null : null);
	let compareScaleB = $derived(compareSelections.length >= 2 ? workspace.find((s) => s.name === compareSelections[1]) ?? null : null);

	function toggleCompareMode() {
		compareMode = !compareMode;
		compareSelections = [];
	}

	function handleCompareSelect(name: string) {
		if (!compareMode) return;
		if (compareSelections.includes(name)) {
			compareSelections = compareSelections.filter((n) => n !== name);
		} else if (compareSelections.length < 2) {
			compareSelections = [...compareSelections, name];
		}
	}

	let generatedHue = $derived(currentScale?.hue ?? null);
	let accentColor = $derived(currentScale?.shades[2]?.hex ?? '#3B82F6');

	// Share state
	let shareToast = $state('');

	async function handleShare() {
		if (workspace.length === 0) return;
		const encoded = encodeShareState(workspace, lockedFamilies);
		const url = buildShareUrl(encoded);
		try {
			await navigator.clipboard.writeText(url);
			shareToast = 'Link copied!';
			setTimeout(() => { shareToast = ''; }, 2000);
		} catch {
			shareToast = 'Copy failed';
			setTimeout(() => { shareToast = ''; }, 2000);
		}
	}
	let tailwindMatch = $derived(currentScale ? findClosestTailwind(currentScale.inputHex) : null);

	// Palette audit — runs when families are uploaded (try/catch for malformed data)
	let audit = $derived.by<PaletteAudit | null>(() => {
		if (comparisonFamilies.length === 0) return null;
		try { return runPaletteAudit(comparisonFamilies); }
		catch (e) { console.error('Palette audit failed:', e); return null; }
	});
	let wheelDots = $derived(audit?.wheelDots ?? []);

	// Persist workspace to localStorage reactively
	$effect(() => {
		saveWorkspace(workspace);
	});

	function handleInputChange(data: { hex: string; name: string }) {
		hexValue = data.hex;
		colorName = data.name;
		if (isValidHex(hexValue)) {
			currentScale = generateScale(hexValue, colorName || 'Custom');
			scaleKey++;
			updateUrl();
			if (!isHistoryNavigation) {
				colourHistory.push(hexValue, colorName);
			}
			isHistoryNavigation = false;
			canGoBack = colourHistory.canGoBack;
			canGoForward = colourHistory.canGoForward;
		}
	}

	function handleSelectFamily(hex: string, name?: string) {
		if (name) colorName = name;
		if (inputPanel) {
			inputPanel.setHex(hex);
		}
	}

	function historyBack() {
		const entry = colourHistory.back();
		if (!entry) return;
		isHistoryNavigation = true;
		colorName = entry.name;
		if (inputPanel) inputPanel.setHex(entry.hex);
		canGoBack = colourHistory.canGoBack;
		canGoForward = colourHistory.canGoForward;
	}

	function historyForward() {
		const entry = colourHistory.forward();
		if (!entry) return;
		isHistoryNavigation = true;
		colorName = entry.name;
		if (inputPanel) inputPanel.setHex(entry.hex);
		canGoBack = colourHistory.canGoBack;
		canGoForward = colourHistory.canGoForward;
	}

	function handleKeyboard(e: KeyboardEvent) {
		const mod = e.metaKey || e.ctrlKey;
		if (!mod) return;
		if (e.key === 'z' && !e.shiftKey) {
			e.preventDefault();
			historyBack();
		} else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
			e.preventDefault();
			historyForward();
		}
	}

	function addToWorkspace() {
		if (!currentScale) return;
		const existing = workspace.findIndex((s) => s.name === currentScale!.name);
		if (existing >= 0) {
			workspace[existing] = currentScale;
		} else {
			workspace = [...workspace, currentScale];
		}
	}

	function handleEdit(scale: ScaleResult) {
		colorName = scale.name;
		if (inputPanel) {
			inputPanel.setHex(scale.inputHex);
		}
	}

	function handleRemove(scale: ScaleResult) {
		workspace = workspace.filter((s) => s.name !== scale.name);
	}

	function updateUrl() {
		if (!currentScale) return;
		const params = new URLSearchParams();
		params.set('hex', hexValue.replace('#', ''));
		if (colorName && colorName !== 'Custom') params.set('name', colorName);
		const newHash = '#' + params.toString();
		if (window.location.hash !== newHash) {
			history.replaceState(null, '', newHash);
		}
	}

	function loadFromUrl() {
		const hash = window.location.hash.slice(1);
		if (!hash) return;
		const params = new URLSearchParams(hash);

		// Check for shared workspace state first
		const shareParam = params.get('share');
		if (shareParam) {
			const payload = decodeShareState(shareParam);
			if (payload) {
				// Restore workspace from shared link
				const restoredScales = payload.workspace
					.filter((e) => isValidHex(e.hex))
					.map((e) => generateScale(e.hex, e.name));
				if (restoredScales.length > 0) {
					workspace = restoredScales;
				}
				// Restore locked families
				if (payload.locked.length > 0) {
					lockedFamilies = new Set(payload.locked);
					saveLocked300(lockedFamilies);
				}
				// Load the first workspace entry into the generator
				if (restoredScales.length > 0) {
					const first = restoredScales[0];
					colorName = first.name;
					if (inputPanel) inputPanel.setHex(first.inputHex);
				}
				// Clear the share hash so it doesn't persist on subsequent edits
				history.replaceState(null, '', window.location.pathname);
				return;
			}
		}

		// Legacy single-color URL format
		const hex = params.get('hex');
		const name = params.get('name');
		if (hex && isValidHex(hex)) {
			colorName = name || 'Custom';
			if (inputPanel) {
				inputPanel.setHex('#' + hex);
			}
		}
	}

	function handleComparisonParse() {
		if (!comparisonJsonInput.trim()) {
			comparisonFamilies = [];
			comparisonErrors = ['Paste your Figma-exported JSON above.'];
			return;
		}
		const result = parseTokenJson(comparisonJsonInput);
		comparisonFamilies = result.families;
		comparisonErrors = result.errors;
		if (result.families.length > 0) {
			saveTokenJson(comparisonJsonInput);
		}
	}

	function handleComparisonDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const file = e.dataTransfer?.files[0];
		if (!file) return;
		if (!file.name.endsWith('.json')) {
			comparisonErrors = ['Please drop a .json file.'];
			return;
		}
		const reader = new FileReader();
		reader.onload = (ev) => {
			comparisonJsonInput = ev.target?.result as string || '';
			handleComparisonParse();
		};
		reader.readAsText(file);
	}

	function handleComparisonFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => {
			comparisonJsonInput = ev.target?.result as string || '';
			handleComparisonParse();
		};
		reader.readAsText(file);
	}

	function clearComparison() {
		comparisonJsonInput = '';
		comparisonFamilies = [];
		comparisonErrors = [];
		clearTokenJson();
	}

	onMount(() => {
		// Restore persisted workspace
		const saved = loadWorkspace();
		if (saved.length > 0) workspace = saved;

		// Restore persisted token JSON
		const savedJson = loadTokenJson();
		if (savedJson) {
			comparisonJsonInput = savedJson;
			handleComparisonParse();
		}

		// Restore locked 300 families
		lockedFamilies = loadLocked300();

		loadFromUrl();
	});
</script>

<svelte:window onkeydown={handleKeyboard} />

<svelte:head>
	<title>Chromatic — Colour Intelligence for Design Systems</title>
	<meta name="description" content="Chromatic: Generate, audit, and optimise design system colour palettes using Oklch perceptual colour science and APCA contrast compliance." />
</svelte:head>

<div class="min-h-screen noise-overlay">
	<!-- Chromatic accent line -->
	<div class="chromatic-accent-line w-full"></div>

	<!-- Header -->
	<header class="border-b" style="border-color: var(--border-subtle)">
		<div class="max-w-[1600px] mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
			<div class="flex items-center gap-3.5">
				<!-- Chromatic logomark — spectrum C -->
				<div class="chromatic-mark w-8 h-8 shrink-0">
					<div class="chromatic-mark-glow"></div>
					<svg viewBox="0 0 32 32" width="32" height="32" fill="none" class="relative z-10">
						<defs>
							<linearGradient id="chromatic-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
								<stop offset="0%" stop-color="#8B5CF6" />
								<stop offset="50%" stop-color="#22D3EE" />
								<stop offset="100%" stop-color="#F59E0B" />
							</linearGradient>
						</defs>
						<path
							d="M22 6.5A11.5 11.5 0 1 0 22 25.5"
							stroke="url(#chromatic-grad)"
							stroke-width="3"
							stroke-linecap="round"
						/>
					</svg>
				</div>
				<div class="flex flex-col">
					<h1 class="font-display text-[18px] font-700 tracking-tight leading-tight" style="color: var(--text-primary)">
						Chromatic
					</h1>
					<span class="text-[11px] font-body font-400 hidden sm:block leading-tight" style="color: var(--text-ghost)">
						Colour intelligence for design systems
					</span>
				</div>
			</div>
			<div class="flex items-center gap-4">
				{#if currentScale}
					<div class="flex items-center gap-2.5 fade-in">
						<div class="w-3 h-3 rounded-full" style="background-color: {currentScale.inputHex}"></div>
						<span class="font-display text-sm font-500" style="color: var(--text-secondary)">{currentScale.name}</span>
						<span
							class="font-mono text-[13px]"
							style="color: var(--text-tertiary)"
							title="{currentScale.isAchromatic ? 'Neutral / achromatic colour' : `Oklch hue angle: ${currentScale.hue.toFixed(1)}°`}"
						>{currentScale.isAchromatic ? 'Neutral' : `${currentScale.hue.toFixed(1)}°`}</span>
					</div>
				{/if}
				{#if workspace.length > 0}
					<button
						onclick={handleShare}
						class="relative flex items-center gap-1.5 font-body text-[12px] font-500 px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-200 hover:opacity-80"
						style="background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); color: var(--text-secondary)"
						title="Copy a shareable link with your workspace scales and locked families"
					>
						<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
							<path d="M6 10.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1" />
							<path d="M10 5.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1" />
						</svg>
						{shareToast || 'Share'}
					</button>
				{/if}
			</div>
		</div>
	</header>

	<main class="max-w-[1600px] mx-auto px-6 lg:px-10 py-8">

		<!-- Top bar: Input + Hue Wheel + Actions -->
		<div
			class="rounded-2xl p-5 mb-8"
			style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
		>
			<div class="flex flex-col md:flex-row gap-6 items-start">
				<!-- Input + History -->
				<div class="w-full md:w-[320px] shrink-0 md:border-r md:pr-6" style="border-color: var(--border-subtle)">
					<InputPanel
						bind:this={inputPanel}
						bind:hexValue
						bind:colorName
						onChange={handleInputChange}
					/>
					{#if canGoBack || canGoForward}
						<div class="flex items-center gap-1.5 mt-2">
							<button
								onclick={historyBack}
								disabled={!canGoBack}
								class="font-mono text-[12px] px-2.5 py-1 rounded-lg cursor-pointer transition-all duration-200 disabled:opacity-30 disabled:cursor-default"
								style="background: var(--surface-2); border: 1px solid var(--border-subtle); color: var(--text-secondary)"
								title="Undo (Cmd/Ctrl+Z)"
							>
								← Undo
							</button>
							<button
								onclick={historyForward}
								disabled={!canGoForward}
								class="font-mono text-[12px] px-2.5 py-1 rounded-lg cursor-pointer transition-all duration-200 disabled:opacity-30 disabled:cursor-default"
								style="background: var(--surface-2); border: 1px solid var(--border-subtle); color: var(--text-secondary)"
								title="Redo (Cmd/Ctrl+Shift+Z)"
							>
								Redo →
							</button>
						</div>
					{/if}
				</div>

				<!-- Hue Wheel -->
				<div class="hidden md:flex flex-1 flex-col items-center gap-2">
					<HueWheel dots={wheelDots} {generatedHue} />
					<p class="text-[12px] font-body text-center max-w-[240px]" style="color: var(--text-tertiary)">
						{#if audit}
							{audit.familyCount} families{audit.gapSuggestions.length > 0 ? ` · ${audit.gapSuggestions.length} suggestions (dashed)` : ''}
						{:else}
							Upload tokens to populate the wheel
						{/if}
					</p>
				</div>

				<!-- Actions -->
				<div class="w-full md:w-[200px] shrink-0 flex flex-col items-stretch gap-2">
					{#if currentScale}
						<button
							onclick={addToWorkspace}
							class="w-full text-[14px] font-body font-500 px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer"
							style="background: {accentColor}; color: white;"
							title="Save this colour family to the workspace"
						>
							+ Add to Workspace
						</button>
					{:else}
						<p class="text-[13px] font-body text-center py-4" style="color: var(--text-tertiary)">
							Enter a hex colour to begin
						</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- Generated Scale -->
		<section class="mb-8">
		<svelte:boundary onerror={(e) => console.error('Scale render error:', e)}>
			{#snippet failed(error, reset)}
				<div class="px-5 py-6 rounded-2xl text-center" style="background: var(--surface-1); border: 1px solid rgba(239,68,68,0.2)">
					<p class="font-body text-[14px] font-500 mb-2" style="color: rgba(239,68,68,0.8)">Something went wrong rendering the scale</p>
					<p class="font-mono text-[12px] mb-3" style="color: var(--text-tertiary)">{error instanceof Error ? error.message : String(error)}</p>
					<button onclick={reset} class="font-body text-[13px] font-500 px-4 py-2 rounded-lg cursor-pointer" style="background: rgba(255,255,255,0.08); color: var(--text-secondary)">Try again</button>
				</div>
			{/snippet}
			{#if currentScale}
				{#key scaleKey}
					<!-- Scale header -->
					<div class="flex items-center gap-3 mb-1">
						<div
							class="w-5 h-5 rounded-md ring-1 ring-white/10"
							style="background-color: {currentScale.inputHex}"
						></div>
						<p class="font-display text-[12px] font-600 uppercase tracking-[0.10em]" style="color: var(--text-secondary)">
							Generated Scale
						</p>
						<div class="flex-1 h-px" style="background: var(--border-subtle)"></div>
						<span class="font-mono text-[12px]" style="color: var(--text-tertiary)">
							{currentScale.name} · {currentScale.isAchromatic ? 'Neutral' : `${currentScale.hue.toFixed(1)}°`} · {currentScale.shades.length} shades
						</span>
						{#if tailwindMatch}
							{@const isMismatch = tailwindMatch.name.toLowerCase() !== currentScale.name.toLowerCase()}
							<span
								class="text-[10px] font-mono font-600 px-2 py-0.5 rounded-md"
								style="background: {isMismatch ? 'rgba(249,115,22,0.10)' : 'rgba(255,255,255,0.06)'}; color: {isMismatch ? 'rgba(249,115,22,0.85)' : 'var(--text-tertiary)'}"
								title="Closest Tailwind CSS v4 colour: {tailwindMatch.name} (Δ{tailwindMatch.hueDelta.toFixed(0)}° hue difference, {tailwindMatch.confidence})"
							>
								TW {tailwindMatch.name}{isMismatch && tailwindMatch.confidence !== 'distant' ? ' ⚠' : ''}
							</span>
						{/if}
					</div>
					<!-- Lightness steps -->
					<div
						class="hidden lg:flex items-center gap-1.5 font-mono text-[12px] mb-4"
						style="color: var(--text-tertiary)"
						title="Lightness steps (ΔL) — the change in Oklch lightness between consecutive shades. Even spacing = perceptually uniform scale."
					>
						<span style="color: var(--text-secondary)">ΔL</span>
						{#each currentScale.shades as shade, i}
							{#if i > 0}
								{@const prev = currentScale.shades[i - 1]}
								{@const delta = Math.abs(shade.oklch.L - prev.oklch.L)}
								<span class="px-1.5 py-0.5 rounded" style="background: var(--surface-2)">{delta.toFixed(3)}</span>
								{#if i < currentScale.shades.length - 1}
									<span style="color: var(--text-ghost)">→</span>
								{/if}
							{/if}
						{/each}
					</div>

					<!-- Card legend -->
					<div
						class="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 px-1 text-[12px] font-body"
						style="color: var(--text-tertiary)"
					>
						<span class="font-500" style="color: var(--text-secondary)">Card key</span>
						<span title="APCA (Accessible Perceptual Contrast Algorithm) measures how readable text is on a background. Lc is the lightness contrast value — higher means easier to read."><strong class="font-600" style="color: var(--text-primary)">APCA</strong> Lc = primary contrast metric</span>
						<span style="color: var(--text-ghost)">|</span>
						<span title="WCAG 2.x contrast ratio is the older standard. We show it for reference, but APCA is the preferred metric for this system."><strong class="font-600" style="color: var(--text-primary)">WCAG 2.x</strong> = informational</span>
						<span style="color: var(--text-ghost)">|</span>
						<span title="Each shade shows two text colour pairings: Standard is the default text colour for that shade in its intended mode, Inverse is the text colour used when the shade appears in the opposite mode (e.g. a light-mode shade used in a dark-mode context)."><strong class="font-600" style="color: var(--text-primary)">Standard</strong> = default text pairing &middot; <strong class="font-600" style="color: var(--text-primary)">Inverse</strong> = opposite mode</span>
					</div>

					<!-- Cards -->
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
						{#each currentScale.shades as shade, i (shade.shade)}
							<div class="shade-card-enter h-full" style="animation-delay: {i * 50}ms">
								<ShadeCard {shade} />
							</div>
						{/each}
					</div>

					<!-- Lightness normalisation note -->
					{#if currentScale.shades[3]?.wasLAdjusted}
						<div
							class="mt-4 px-4 py-3 rounded-xl text-[13px] font-body"
							style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); color: var(--text-tertiary)"
						>
							<strong style="color: var(--text-secondary)">Lightness normalised:</strong> Your input's L* was {currentScale.shades[3].originalL.toFixed(3)} — the 300 shade is generated at the optimal L* {currentScale.shades[3].oklch.L.toFixed(3)} for APCA contrast compliance. Hue and chroma are preserved from your input.
						</div>
					{/if}
				{/key}

				<!-- Scale preview — token usage + colour vision -->
				<div class="mt-4">
					<ScalePreview scale={currentScale} />
				</div>
			{:else}
				<!-- Empty state -->
				<div
					class="relative flex flex-col items-center justify-center py-24 rounded-2xl gap-5 fade-in overflow-hidden"
					style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
				>
					<!-- Atmospheric spectrum glow -->
					<div
						class="absolute inset-0 pointer-events-none"
						style="background: radial-gradient(ellipse 60% 50% at 50% 30%, rgba(139,92,246,0.06) 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 30% 60%, rgba(34,211,238,0.04) 0%, transparent 50%), radial-gradient(ellipse 50% 50% at 70% 60%, rgba(245,158,11,0.04) 0%, transparent 50%)"
					></div>
					<!-- Spectrum swatches — brand triad -->
					<div class="relative flex gap-1.5">
						{#each [
							{ l: 0.94, c: 0.04, h: 285 },
							{ l: 0.85, c: 0.09, h: 270 },
							{ l: 0.70, c: 0.14, h: 200 },
							{ l: 0.55, c: 0.17, h: 180 },
							{ l: 0.40, c: 0.10, h: 80 },
							{ l: 0.35, c: 0.06, h: 60 }
						] as s, i}
							<div
								class="w-10 h-10 rounded-lg"
								style="background: oklch({s.l} {s.c} {s.h}); box-shadow: 0 2px 12px oklch({s.l} {s.c} {s.h} / 0.25); opacity: 0; animation: card-enter 0.5s cubic-bezier(0.22, 1, 0.36, 1) {i * 80}ms both"
							></div>
						{/each}
					</div>
					<!-- Brand wordmark -->
					<div class="relative flex flex-col items-center gap-1.5 mt-2">
						<p class="text-[18px] font-display font-700 tracking-tight" style="color: var(--text-primary)">
							Start with a colour
						</p>
						<p class="text-[13px] font-body max-w-sm text-center leading-relaxed" style="color: var(--text-tertiary)">
							Enter a hex value above to generate an APCA-compliant 6-shade scale, or upload your Figma design tokens below to audit an existing palette.
						</p>
					</div>
				</div>
			{/if}
		</svelte:boundary>
		</section>

		<!-- Palette Analysis — Upload, Compare, Audit (unified section) -->
		<section class="mb-8">
		<svelte:boundary onerror={(e) => console.error('Palette analysis error:', e)}>
			{#snippet failed(error, reset)}
				<div class="px-5 py-6 rounded-2xl text-center" style="background: var(--surface-1); border: 1px solid rgba(239,68,68,0.2)">
					<p class="font-body text-[14px] font-500 mb-2" style="color: rgba(239,68,68,0.8)">Something went wrong with the palette analysis</p>
					<p class="font-mono text-[12px] mb-3" style="color: var(--text-tertiary)">{error instanceof Error ? error.message : String(error)}</p>
					<button onclick={() => { clearComparison(); reset(); }} class="font-body text-[13px] font-500 px-4 py-2 rounded-lg cursor-pointer" style="background: rgba(255,255,255,0.08); color: var(--text-secondary)">Reset</button>
				</div>
			{/snippet}
			<div class="flex items-center gap-3 mb-3">
				<p class="font-display text-[12px] font-600 uppercase tracking-[0.10em]" style="color: var(--text-secondary)">
					Palette Analysis
				</p>
				<div class="flex-1 h-px" style="background: var(--border-subtle)"></div>
				{#if comparisonFamilies.length > 0}
					<p class="font-body text-[12px]" style="color: var(--text-tertiary)">
						{comparisonFamilies.length} {comparisonFamilies.length === 1 ? 'family' : 'families'} loaded &middot; click a family to generate
					</p>
				{/if}
			</div>

			{#if comparisonFamilies.length === 0}
				<!-- Upload state -->
				<div
					class="rounded-2xl overflow-hidden"
					style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
				>
					<div
						class="relative p-6 transition-all duration-200"
						style="
							border-bottom: 2px dashed {isDragging ? 'var(--text-secondary)' : 'var(--border-medium)'};
							background: {isDragging ? 'rgba(255,255,255,0.03)' : 'transparent'};
						"
						role="region"
						aria-label="File drop zone"
						ondragover={(e) => { e.preventDefault(); isDragging = true; }}
						ondragleave={() => (isDragging = false)}
						ondrop={handleComparisonDrop}
					>
						<div class="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
							<div class="flex-1 text-center sm:text-left">
								<p class="font-body text-[14px] font-500" style="color: var(--text-primary)">
									Upload your Figma token export
								</p>
								<p class="font-body text-[13px] mt-1" style="color: var(--text-tertiary)">
									Drop <span class="font-mono text-[12px]" style="color: var(--text-secondary)">Value.tokens.json</span> here, or
									<label class="cursor-pointer underline underline-offset-2 transition-opacity hover:opacity-70" style="color: var(--text-secondary)">
										browse
										<input type="file" accept=".json" class="sr-only" onchange={handleComparisonFileInput} />
									</label>
								</p>
							</div>
							<div class="shrink-0 text-[13px] font-body" style="color: var(--text-ghost)">
								Analyses, compares, and audits your colour palette
							</div>
						</div>
					</div>

					<div class="p-5 space-y-3">
						<textarea
							bind:value={comparisonJsonInput}
							placeholder="Or paste the JSON contents here..."
							class="w-full h-24 px-4 py-3 rounded-xl font-mono text-[12px] resize-y transition-all focus-visible:ring-1 focus-visible:ring-white/20"
							style="background: var(--surface-2); border: 1px solid var(--border-subtle); color: var(--text-primary); outline: none;"
						></textarea>
						<button
							onclick={handleComparisonParse}
							class="font-body text-[13px] font-500 px-5 py-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:opacity-90"
							style="background: {accentColor}; color: white"
						>
							Analyse Tokens
						</button>
					</div>
				</div>
			{:else}
				<!-- Results: comparison view with inline audit data -->
				<div
					class="rounded-2xl overflow-hidden mb-5"
					style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
				>
					<div class="flex items-center justify-between px-5 py-3.5" style="border-bottom: 1px solid var(--border-subtle)">
						<p class="font-body text-[13px]" style="color: var(--text-secondary)">
							Click a family swatch or name to load it into the generator
						</p>
						<button
							onclick={clearComparison}
							class="font-body text-[13px] font-500 px-3.5 py-1.5 rounded-lg cursor-pointer transition-all duration-200 hover:opacity-80"
							style="background: rgba(255,255,255,0.06); color: var(--text-tertiary)"
						>
							Replace JSON
						</button>
					</div>
					<div class="p-5">
						<ComparisonView
							families={comparisonFamilies}
							{audit}
							onSelectFamily={handleSelectFamily}
							{lockedFamilies}
							onToggleLock={handleToggleLock}
						/>
					</div>
				</div>

				<!-- Hue collisions + Suggested additions (palette-wide insights) -->
				{#if audit && (audit.proximityWarnings.length > 0 || audit.gapSuggestions.length > 0)}
					<PaletteAuditPanel
						{audit}
						onSelectFamily={handleSelectFamily}
					/>
				{/if}
			{/if}

			{#if comparisonErrors.length > 0}
				<div class="mt-3 space-y-1">
					{#each comparisonErrors as err}
						<p class="font-body text-[12px]" style="color: #f59e0b">{err}</p>
					{/each}
				</div>
			{/if}
		</svelte:boundary>
		</section>

		<!-- Saved Scales -->
		{#if workspace.length > 0}
			<section class="mb-8 fade-in">
				<div class="flex items-center gap-3 mb-3">
					<p class="font-display text-[12px] font-600 uppercase tracking-[0.10em]" style="color: var(--text-secondary)">
						Saved Scales
					</p>
					<div class="flex-1 h-px" style="background: var(--border-subtle)"></div>
					{#if workspace.length >= 2}
						<button
							onclick={toggleCompareMode}
							class="font-body text-[12px] font-500 px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-200"
							style="background: {compareMode ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)'}; border: 1px solid {compareMode ? 'rgba(59,130,246,0.3)' : 'var(--border-subtle)'}; color: {compareMode ? 'rgba(59,130,246,0.9)' : 'var(--text-tertiary)'}"
						>
							{compareMode ? 'Exit Compare' : 'Compare'}
						</button>
					{/if}
					<p class="font-mono text-[12px]" style="color: var(--text-tertiary)">
						{#if compareMode}
							Select 2 scales to compare ({compareSelections.length}/2)
						{:else}
							{workspace.length} {workspace.length === 1 ? 'family' : 'families'} · hover to edit or remove
						{/if}
					</p>
				</div>

				<!-- Scale comparison view -->
				{#if compareScaleA && compareScaleB}
					<div class="mb-3">
						<ScaleComparison
							scaleA={compareScaleA}
							scaleB={compareScaleB}
							onClose={toggleCompareMode}
						/>
					</div>
				{/if}

				<div class="space-y-2">
					{#each workspace as scale (scale.name)}
						{#if compareMode}
							<button
								onclick={() => handleCompareSelect(scale.name)}
								class="w-full text-left cursor-pointer rounded-xl transition-all duration-200"
								style="outline: {compareSelections.includes(scale.name) ? '2px solid rgba(59,130,246,0.6)' : 'none'}; outline-offset: 2px;"
							>
							<WorkspaceStrip
								{scale}
								onEdit={handleEdit}
								onRemove={handleRemove}
							/>
						</button>
					{:else}
						<WorkspaceStrip
							{scale}
							onEdit={handleEdit}
							onRemove={handleRemove}
						/>
						{/if}
					{/each}
				</div>
			</section>
		{/if}
	</main>
</div>
