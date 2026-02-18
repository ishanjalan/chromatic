<script lang="ts">
	import { onMount } from 'svelte';
	import { generateScale } from '$lib/scale';
	import type { ScaleResult } from '$lib/scale';
	import { isValidHex, hexToRgb, rgbToOklch } from '$lib/colour';
	import { findTopMatches } from '$lib/colour-match';
	import type { ColourMatch } from '$lib/colour-match';
	import { parseTokenJson, detectTokenType } from '$lib/parse-tokens';
	import type { ParsedFamily } from '$lib/parse-tokens';
	import { parseSemanticJson } from '$lib/parse-semantic-tokens';
	import type { SemanticParseResult } from '$lib/parse-semantic-tokens';
	import { analyseCoverage } from '$lib/primitive-coverage';
	import type { CoverageAnalysis } from '$lib/primitive-coverage';
	import { runPaletteAudit } from '$lib/palette-audit';
	import type { PaletteAudit } from '$lib/palette-audit';
	import { saveWorkspace, loadWorkspace, saveTokenJson, loadTokenJson, clearTokenJson, saveLocked300, loadLocked300, saveLegendDismissed, loadLegendDismissed, saveSemanticJsons, loadSemanticJsons, clearSemanticJsons } from '$lib/persistence';
	import { ColourHistory } from '$lib/history';
	import { encodeShareState, decodeShareState, buildShareUrl } from '$lib/share';
	import HueWheel from '$lib/components/HueWheel.svelte';
	import ShadeCard from '$lib/components/ShadeCard.svelte';
	import InputPanel from '$lib/components/InputPanel.svelte';
	import ComparisonView from '$lib/components/ComparisonView.svelte';
	import PaletteAuditPanel from '$lib/components/PaletteAudit.svelte';
	import ScalePreview from '$lib/components/ScalePreview.svelte';
	import GradientStrip from '$lib/components/GradientStrip.svelte';
	import ApcaMatrix from '$lib/components/ApcaMatrix.svelte';
	import NeutralAnalysis from '$lib/components/NeutralAnalysis.svelte';
	import PrimitiveCoverage from '$lib/components/PrimitiveCoverage.svelte';
	import type { AchromaticFamily } from '$lib/parse-tokens';

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
	let achromaticFamilies = $state<AchromaticFamily[]>([]);
	let comparisonErrors = $state<string[]>([]);
	let comparisonJsonInput = $state('');
	let isDragging = $state(false);
	let legendDismissed = $state(false);

	// Semantic token coverage state
	let semanticResults = $state<SemanticParseResult[]>([]);
	let semanticFiles = $state<Array<{ fileName: string; json: string }>>([]);
	let coverageAnalysis = $state<CoverageAnalysis | null>(null);

	// Locked 300 shades — per-family override to preserve the original 300 hex
	let lockedFamilies = $state<Set<string>>(new Set());

	function handleToggleLock(familyName: string) {
		const next = new Set(lockedFamilies);
		if (next.has(familyName)) next.delete(familyName);
		else next.add(familyName);
		lockedFamilies = next;
		saveLocked300(next);
	}

	let generatedHue = $derived(currentScale?.hue ?? null);
	let accentColor = $derived(currentScale?.shades[2]?.hex ?? '#3B82F6');

	function scrollToSection(id: string) {
		const el = document.getElementById(id);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

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
	// Pinned suggestions: frozen to the user's manually entered hex so clicking
	// a suggestion pill doesn't replace the list. Only refreshes on manual input.
	let pinnedSuggestions = $state<ColourMatch[]>([]);
	let pinnedForHex = $state('');
	let activeSuggestionHex = $state<string | null>(null);

	// Merge workspace-only scales into comparison families for full-palette analysis.
	// Workspace scales that share a name with an uploaded family are skipped (token version wins).
	// All families are sorted by Oklch hue so manually added ones slot into the correct position.
	let allFamilies = $derived.by<ParsedFamily[]>(() => {
		const uploadedNames = new Set(comparisonFamilies.map((f) => f.name));
		const tokenFamilies: ParsedFamily[] = comparisonFamilies.map((f) => ({ ...f, source: 'token' as const }));
		const workspaceOnly: ParsedFamily[] = workspace
			.filter((s) => !uploadedNames.has(s.name))
			.map((s) => ({
				name: s.name,
				shades: Object.fromEntries(s.shades.map((sh) => [sh.shade, sh.hex])),
				complete: s.shades.length === 6,
				source: 'workspace' as const
			}));
		const merged = [...tokenFamilies, ...workspaceOnly];

		// Sort by Oklch hue of the 300 shade (or best available shade)
		function familyHue(fam: ParsedFamily): number {
			const hex = fam.shades[300] ?? Object.values(fam.shades)[0];
			if (!hex) return 0;
			try {
				const { r, g, b } = hexToRgb(hex);
				const { H } = rgbToOklch(r, g, b);
				return H;
			} catch { return 0; }
		}
		merged.sort((a, b) => familyHue(a) - familyHue(b));
		return merged;
	});

	// Palette audit — runs when families exist (uploaded OR workspace)
	let audit = $derived.by<PaletteAudit | null>(() => {
		if (allFamilies.length === 0) return null;
		try { return runPaletteAudit(allFamilies); }
		catch (e) { console.error('Palette audit failed:', e); return null; }
	});
	let wheelDots = $derived(audit?.wheelDots ?? []);

	// Section anchors for sticky nav — must be after allFamilies/audit definitions
	type SectionAnchor = { id: string; label: string };
	let sectionAnchors = $derived.by(() => {
		const anchors: SectionAnchor[] = [];
		if (currentScale) anchors.push({ id: 'generator', label: 'Generator' });
		if (allFamilies.length > 0) anchors.push({ id: 'palette', label: 'Palette' });
		if (allFamilies.length > 0) anchors.push({ id: 'apca-matrix', label: 'APCA' });
		if (audit && (audit.proximityWarnings.length > 0 || audit.gapSuggestions.length > 0)) anchors.push({ id: 'suggestions', label: 'Suggestions' });
		if (achromaticFamilies.length > 0) anchors.push({ id: 'neutrals', label: 'Neutrals' });
		if (coverageAnalysis) anchors.push({ id: 'coverage', label: 'Coverage' });
		return anchors;
	});

	// Persist workspace to localStorage reactively
	$effect(() => {
		saveWorkspace(workspace);
	});

	let isSuggestionNav = false;

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

			// Only refresh suggestions for genuinely new manual input, not pill clicks
			if (!isSuggestionNav) {
				const normalized = hexValue.toLowerCase();
				if (normalized !== pinnedForHex) {
					pinnedSuggestions = findTopMatches(hexValue, 5);
					pinnedForHex = normalized;
					activeSuggestionHex = null;
				}
			}
			isSuggestionNav = false;
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
		let scale = currentScale;

		// Disambiguate if name collides with an uploaded token family
		const uploadedNames = new Set(comparisonFamilies.map((f) => f.name));
		if (uploadedNames.has(scale.name)) {
			const suffix = activeSuggestionHex ? ' (suggested)' : ' (manual)';
			scale = generateScale(scale.inputHex, scale.name + suffix);
		}

		const existing = workspace.findIndex((s) => s.name === scale.name);
		if (existing >= 0) {
			workspace[existing] = scale;
		} else {
			workspace = [...workspace, scale];
		}
	}

	function handleRemoveWorkspaceFamily(familyName: string) {
		workspace = workspace.filter((s) => s.name !== familyName);
	}

	function handleAddToWorkspaceDirect(hex: string, name: string, source?: string) {
		// Disambiguate if name collides with uploaded token family or existing workspace entry
		const uploadedNames = new Set(comparisonFamilies.map((f) => f.name));
		const workspaceNames = new Set(workspace.map((s) => s.name));
		let finalName = name;
		if (uploadedNames.has(name) || workspaceNames.has(name)) {
			// Append source (e.g. "Cyan (Tailwind)") for clarity
			const suffix = source ? ` (${source})` : ' (suggested)';
			finalName = `${name}${suffix}`;
			// If that also collides, it replaces the same-source entry (intended)
		}
		const scale = generateScale(hex, finalName);
		const existing = workspace.findIndex((s) => s.name === scale.name);
		if (existing >= 0) {
			workspace[existing] = scale;
		} else {
			workspace = [...workspace, scale];
		}
	}

	function handleAcceptProposed(familyName: string) {
		if (!audit) return;
		const tweak = audit.shade300Tweaks.find((t) => t.family === familyName);
		if (!tweak) return;
		const scale = generateScale(tweak.suggestedHex, familyName);
		const existing = workspace.findIndex((s) => s.name === scale.name);
		if (existing >= 0) {
			workspace[existing] = scale;
		} else {
			workspace = [...workspace, scale];
		}
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
		achromaticFamilies = result.achromaticFamilies;
		comparisonErrors = result.errors;
		if (result.families.length > 0 || result.achromaticFamilies.length > 0) {
			saveTokenJson(comparisonJsonInput);
		}
		recomputeCoverage();
	}

	/** Process a single uploaded file — auto-detects type and routes accordingly */
	function processUploadedFile(content: string, fileName: string) {
		const type = detectTokenType(content);

		if (type === 'semantic') {
			const result = parseSemanticJson(content, fileName);
			// Avoid duplicate labels — replace if same mode is re-uploaded
			const existing = semanticResults.filter((r) => r.label !== result.label);
			semanticResults = [...existing, result];

			const existingFiles = semanticFiles.filter((f) => {
				const label = f.fileName.toLowerCase().includes('light') ? 'Light' :
					f.fileName.toLowerCase().includes('dark') ? 'Dark' : f.fileName;
				return label !== result.label;
			});
			semanticFiles = [...existingFiles, { fileName, json: content }];
			saveSemanticJsons(semanticFiles);

			if (result.errors.length > 0) {
				comparisonErrors = [...comparisonErrors, ...result.errors.map((e) => `${result.label}: ${e}`)];
			}

			recomputeCoverage();
		} else if (type === 'primitive') {
			comparisonJsonInput = content;
			handleComparisonParse();
		} else {
			comparisonErrors = [...comparisonErrors, `${fileName}: Could not parse as JSON.`];
		}
	}

	/** Recompute coverage analysis whenever primitives or semantic data changes */
	function recomputeCoverage() {
		if (
			(comparisonFamilies.length > 0 || achromaticFamilies.length > 0) &&
			semanticResults.length > 0
		) {
			coverageAnalysis = analyseCoverage(comparisonFamilies, achromaticFamilies, semanticResults);
		} else {
			coverageAnalysis = null;
		}
	}

	function handleComparisonDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const files = e.dataTransfer?.files;
		if (!files || files.length === 0) return;

		comparisonErrors = [];
		let pendingReads = files.length;

		for (const file of files) {
			if (!file.name.endsWith('.json')) {
				comparisonErrors = [...comparisonErrors, `${file.name}: Not a .json file — skipped.`];
				pendingReads--;
				continue;
			}
			const reader = new FileReader();
			reader.onload = (ev) => {
				const content = ev.target?.result as string || '';
				processUploadedFile(content, file.name);
				pendingReads--;
			};
			reader.readAsText(file);
		}
	}

	function handleComparisonFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = input.files;
		if (!files || files.length === 0) return;

		comparisonErrors = [];

		for (const file of files) {
			const reader = new FileReader();
			reader.onload = (ev) => {
				const content = ev.target?.result as string || '';
				processUploadedFile(content, file.name);
			};
			reader.readAsText(file);
		}
	}

	function clearComparison() {
		comparisonJsonInput = '';
		comparisonFamilies = [];
		achromaticFamilies = [];
		comparisonErrors = [];
		semanticResults = [];
		semanticFiles = [];
		coverageAnalysis = null;
		clearTokenJson();
		clearSemanticJsons();
	}

	function clearSemanticOnly() {
		semanticResults = [];
		semanticFiles = [];
		coverageAnalysis = null;
		clearSemanticJsons();
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

		// Restore persisted semantic token JSONs
		const savedSemantic = loadSemanticJsons();
		if (savedSemantic.length > 0) {
			for (const { fileName, json } of savedSemantic) {
				const result = parseSemanticJson(json, fileName);
				semanticResults = [...semanticResults, result];
			}
			semanticFiles = savedSemantic;
			recomputeCoverage();
		}

		// Restore locked 300 families
		lockedFamilies = loadLocked300();

		// Restore legend dismissal
		legendDismissed = loadLegendDismissed();

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
	<header class="sticky top-0 z-40 header-glow" style="background: rgba(9, 9, 11, 0.82); backdrop-filter: blur(16px) saturate(1.4); -webkit-backdrop-filter: blur(16px) saturate(1.4);">
		<div class="max-w-[1600px] mx-auto px-6 lg:px-10 py-3.5 flex items-center justify-between">
			<div class="flex items-center gap-3.5">
				<!-- Chromatic logomark — spectrum C -->
				<div class="chromatic-mark w-9 h-9 shrink-0">
					<div class="chromatic-mark-glow"></div>
					<svg viewBox="0 0 32 32" width="36" height="36" fill="none" class="relative z-10">
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
				{#if sectionAnchors.length > 0}
					<nav class="hidden md:flex items-center gap-0.5">
						{#each sectionAnchors as anchor (anchor.id)}
							<button
								onclick={() => scrollToSection(anchor.id)}
								class="nav-pill px-3 py-1.5 rounded-md text-[11px] font-body font-500 cursor-pointer"
								style="color: var(--text-tertiary)"
							>
								{anchor.label}
							</button>
						{/each}
					</nav>
				{/if}
				{#if currentScale}
					<div class="flex items-center gap-2.5 fade-in" style="border-left: 1px solid var(--border-subtle); padding-left: 1rem">
						<div class="w-3 h-3 rounded-full" style="background-color: {currentScale.inputHex}; box-shadow: 0 0 8px {currentScale.inputHex}50"></div>
						<span class="font-display text-sm font-500" style="color: var(--text-secondary)">{currentScale.name}</span>
						<span
							class="font-mono text-[12px]"
							style="color: var(--text-ghost)"
							title="{currentScale.isAchromatic ? 'Neutral / achromatic colour' : `Oklch hue angle: ${currentScale.hue.toFixed(1)}°`}"
						>{currentScale.isAchromatic ? 'Neutral' : `${currentScale.hue.toFixed(1)}°`}</span>
					</div>
				{/if}
			</div>
		</div>
		<div class="chromatic-accent-line"></div>
	</header>

	<main class="max-w-[1600px] mx-auto px-6 lg:px-10 py-8">

		{#if !currentScale && allFamilies.length === 0}
			<!-- Two-lane onboarding: shown when there's no data at all -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8 fade-in">
				<!-- Lane A: Audit existing palette (primary) -->
				<div
					class="group rounded-2xl p-7 flex flex-col gap-5 relative overflow-hidden transition-all duration-300 interactive-surface"
					style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
				>
					<div
						class="absolute inset-0 pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-70"
						style="background: radial-gradient(ellipse 80% 60% at 30% 20%, rgba(34,211,238,0.06) 0%, transparent 60%)"
					></div>
					<div class="relative">
						<div class="flex items-center gap-2.5 mb-3">
							<span class="text-[10px] font-mono font-600 px-2 py-0.5 rounded-md" style="background: rgba(34,211,238,0.10); color: rgba(34,211,238,0.9)">Recommended</span>
						</div>
						<p class="text-[18px] font-display font-700 tracking-tight" style="color: var(--text-primary)">
							Audit your existing palette
						</p>
						<p class="text-[13px] font-body mt-2 leading-relaxed" style="color: var(--text-tertiary)">
							Drop your Figma token export to analyse colour health, flag contrast issues, and discover expansion opportunities.
						</p>
					</div>
					<div class="relative flex-1">
						<div
							class="relative rounded-xl transition-all duration-200 text-center"
							style="
								border: 2px dashed {isDragging ? 'rgba(34,211,238,0.5)' : 'var(--border-medium)'};
								background: {isDragging ? 'rgba(34,211,238,0.04)' : 'rgba(255,255,255,0.015)'};
								padding: 1.5rem 1.25rem;
							"
							role="region"
							aria-label="File drop zone"
							ondragover={(e) => { e.preventDefault(); isDragging = true; }}
							ondragleave={() => (isDragging = false)}
							ondrop={handleComparisonDrop}
						>
							<svg class="mx-auto mb-3 opacity-30" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
							</svg>
							<p class="font-body text-[13px]" style="color: var(--text-secondary)">
								Drop <code class="font-mono text-[11px] px-1.5 py-0.5 rounded" style="background: var(--surface-2)">.json</code> token files here
							</p>
							<p class="font-body text-[12px] mt-1.5" style="color: var(--text-ghost)">
								Primitives + semantic, or
								<label class="cursor-pointer underline underline-offset-2 transition-opacity hover:opacity-70" style="color: var(--text-secondary)">
									browse files
									<input type="file" accept=".json" multiple class="sr-only" onchange={handleComparisonFileInput} />
								</label>
							</p>
						</div>
						<div class="mt-3">
							<textarea
								bind:value={comparisonJsonInput}
								placeholder="Or paste JSON contents here..."
								class="w-full h-20 px-3.5 py-2.5 rounded-xl font-mono text-[11px] resize-y transition-all focus-visible:ring-1 focus-visible:ring-white/20"
								style="background: var(--surface-2); border: 1px solid var(--border-subtle); color: var(--text-primary); outline: none;"
							></textarea>
							<button
								onclick={handleComparisonParse}
								class="cta-glow mt-2 font-body text-[13px] font-500 px-5 py-2.5 rounded-xl cursor-pointer"
								style="background: {accentColor}; color: white; --cta-glow-color: {accentColor}40"
							>
								Analyse Tokens
							</button>
						</div>
					</div>
				</div>

				<!-- Lane B: Start from scratch (secondary) -->
				<div
					class="group rounded-2xl p-7 flex flex-col gap-5 relative overflow-hidden transition-all duration-300 interactive-surface"
					style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
				>
					<div
						class="absolute inset-0 pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-50"
						style="background: radial-gradient(ellipse 80% 60% at 70% 80%, rgba(139,92,246,0.05) 0%, transparent 60%)"
					></div>
					<div class="relative">
						<p class="text-[18px] font-display font-700 tracking-tight" style="color: var(--text-primary)">
							Build a scale from scratch
						</p>
						<p class="text-[13px] font-body mt-2 leading-relaxed" style="color: var(--text-tertiary)">
							Enter any hex colour to generate a perceptually uniform 6-shade scale with APCA contrast compliance built in.
						</p>
					</div>
					<div class="relative flex-1">
						<InputPanel
							bind:this={inputPanel}
							bind:hexValue
							bind:colorName
							onChange={handleInputChange}
						/>
					</div>
				</div>
			</div>

			{#if comparisonErrors.length > 0}
				<div class="mb-5 space-y-1">
					{#each comparisonErrors as err}
						<p class="font-body text-[12px]" style="color: #f59e0b">{err}</p>
					{/each}
				</div>
			{/if}
		{:else}
			<!-- Normal mode: Input bar + Hue Wheel -->
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
									class="font-mono text-[12px] px-2.5 py-1 rounded-lg cursor-pointer transition-all duration-200 disabled:opacity-30 disabled:cursor-default inline-flex items-center gap-1.5"
									style="background: var(--surface-2); border: 1px solid var(--border-subtle); color: var(--text-secondary)"
									title="Undo (Cmd/Ctrl+Z)"
								>
									← Undo <kbd>⌘Z</kbd>
								</button>
								<button
									onclick={historyForward}
									disabled={!canGoForward}
									class="font-mono text-[12px] px-2.5 py-1 rounded-lg cursor-pointer transition-all duration-200 disabled:opacity-30 disabled:cursor-default inline-flex items-center gap-1.5"
									style="background: var(--surface-2); border: 1px solid var(--border-subtle); color: var(--text-secondary)"
									title="Redo (Cmd/Ctrl+Shift+Z)"
								>
									Redo → <kbd>⇧⌘Z</kbd>
								</button>
							</div>
						{/if}

						<!-- Reference colour suggestions (pinned to original manual input) -->
						{#if pinnedSuggestions.length > 0 && currentScale}
							<div class="mt-4 pt-3" style="border-top: 1px solid var(--border-subtle)">
								<p class="text-[10px] font-display font-600 uppercase tracking-[0.10em] mb-2" style="color: var(--text-ghost)">
									Use a tested reference instead?
								</p>
								<div class="flex flex-wrap gap-1.5">
									{#each pinnedSuggestions as sug}
										{@const srcLabel = sug.source === 'Tailwind' ? 'TW' : sug.source === 'Spectrum' ? 'SP' : 'RX'}
										{@const isActive = activeSuggestionHex === sug.previewHex}
										<button
											class="inline-flex items-center gap-1.5 text-[11px] font-mono font-500 pl-1.5 pr-2.5 py-1 rounded-lg cursor-pointer transition-all duration-200 hover:brightness-125 hover:scale-[1.02]"
											style="background: {isActive ? 'rgba(255,255,255,0.12)' : 'var(--surface-2)'}; border: 1px solid {isActive ? 'rgba(255,255,255,0.20)' : 'var(--border-subtle)'}; color: var(--text-secondary)"
											title="Preview {sug.source} {sug.name} ({sug.previewHex}) — Δ{sug.hueDelta.toFixed(0)}° from your input"
											onclick={() => {
												isSuggestionNav = true;
												activeSuggestionHex = sug.previewHex;
												colorName = sug.name;
												if (inputPanel) inputPanel.setHex(sug.previewHex);
											}}
										>
											<span class="w-3.5 h-3.5 rounded-[4px] ring-1 ring-white/10 shrink-0" style="background-color: {sug.previewHex}"></span>
											<span style="color: var(--text-ghost)">{srcLabel}</span>
											{sug.name}
											<span style="color: var(--text-ghost)">Δ{sug.hueDelta.toFixed(0)}°</span>
										</button>
									{/each}
								</div>
								<p class="text-[10px] font-body mt-1.5 leading-relaxed" style="color: var(--text-ghost)">
									Click to preview. Battle-tested colours from Tailwind, Spectrum, and Radix.
								</p>
							</div>
						{/if}
					</div>

					<!-- Hue Wheel — only shown when it has data -->
					{#if wheelDots.length > 0 || generatedHue !== null}
						<div class="hidden md:flex flex-1 flex-col items-center gap-2">
							<HueWheel dots={wheelDots} {generatedHue} />
							<p class="text-[12px] font-body text-center max-w-[240px]" style="color: var(--text-tertiary)">
								{#if audit}
									{audit.familyCount} families{audit.gapSuggestions.length > 0 ? ` · ${audit.gapSuggestions.length} suggestions (dashed)` : ''}
								{:else}
									Your generated colour on the hue wheel
								{/if}
							</p>
						</div>
					{/if}
				</div>
			</div>

		<!-- Workspace strip — compact indicator of workspace families -->
		{#if workspace.length > 0}
			<div
				class="rounded-xl px-4 py-2.5 mb-5 flex items-center gap-3 flex-wrap fade-in interactive-surface"
				style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
			>
				<span class="shrink-0 font-body text-[11px] font-600 uppercase tracking-wider" style="color: var(--text-ghost)">
					{workspace.length} {workspace.length === 1 ? 'family' : 'families'}
				</span>
				<div class="flex items-center gap-1.5 flex-wrap">
					{#each workspace as ws, i (ws.name)}
						<button
							class="w-5 h-5 rounded-full ring-1 ring-white/10 cursor-pointer transition-all hover:ring-2 hover:ring-white/30 hover:scale-125 dot-appear"
							style="background-color: {ws.shades[3]?.hex ?? ws.inputHex}; animation-delay: {i * 30}ms; box-shadow: 0 0 6px {ws.shades[3]?.hex ?? ws.inputHex}30"
							title="{ws.name} ({ws.inputHex}) — click to load"
							onclick={() => handleSelectFamily(ws.inputHex, ws.name)}
						></button>
					{/each}
				</div>
				<div class="flex-1"></div>
				{#if workspace.length > 0}
					<button
						onclick={handleShare}
						class="font-body text-[10px] font-500 px-2.5 py-1 rounded-md cursor-pointer transition-all hover:opacity-70"
						style="background: rgba(255,255,255,0.04); color: var(--text-tertiary)"
						title="Copy a shareable link with your workspace"
					>
						{shareToast || 'Share'}
					</button>
					<button
						onclick={() => { workspace = []; }}
						class="font-body text-[10px] font-500 px-2.5 py-1 rounded-md cursor-pointer transition-all hover:opacity-70"
						style="background: rgba(239,68,68,0.06); color: rgba(239,68,68,0.6)"
						title="Remove all families from the workspace"
					>
						Clear
					</button>
				{/if}
			</div>
		{/if}

		<!-- Generated Scale -->
		<section id="generator" class="mb-8 scroll-mt-16">
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
						<p class="section-heading font-display text-[12px] font-600 uppercase tracking-[0.10em]" style="color: var(--text-secondary)">
							Generated Scale
						</p>
						<div class="flex-1 h-px" style="background: var(--border-subtle)"></div>
						<span class="font-mono text-[12px]" style="color: var(--text-tertiary)">
							{currentScale.name} · {currentScale.isAchromatic ? 'Neutral' : `${currentScale.hue.toFixed(1)}°`} · {currentScale.shades.length} shades
						</span>
						<button
							onclick={addToWorkspace}
							class="cta-glow text-[13px] font-body font-500 px-4 py-1.5 rounded-lg cursor-pointer"
							style="background: {accentColor}; color: white; --cta-glow-color: {accentColor}40"
							title="Save this colour family to the workspace"
						>
							+ Add to Workspace
						</button>
					</div>
					<!-- Lightness steps (collapsed into a badge on the header row) -->
					{@const shades = currentScale.shades}
					{@const deltas = shades.slice(1).map((s, i) => Math.abs(s.oklch.L - shades[i].oklch.L))}
					{@const maxDelta = Math.max(...deltas)}
					{@const minDelta = Math.min(...deltas)}
					{@const isUniform = maxDelta - minDelta < 0.08}
					<div class="flex items-center gap-2 mb-4">
						<span
							class="text-[10px] font-body font-600 px-2 py-0.5 rounded-md"
							style="background: {isUniform ? 'rgba(16,185,129,0.10)' : 'rgba(245,158,11,0.10)'}; color: {isUniform ? '#10b981' : '#f59e0b'}"
							title="Lightness steps: {deltas.map(d => d.toFixed(3)).join(' → ')}. {isUniform ? 'Even spacing = smooth, uniform scale.' : 'Uneven spacing = some perceptual jumps between shades.'}"
						>
							L* steps: {isUniform ? 'Uniform' : 'Uneven'}
						</span>

						<!-- Card legend toggle -->
						{#if !legendDismissed}
							<div
								class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-body flex-1"
								style="color: var(--text-ghost)"
							>
								<span title="APCA Lc = primary readability metric. Higher Lc means easier to read."><strong style="color: var(--text-tertiary)">Readability</strong> (APCA Lc)</span>
								<span>·</span>
								<span title="WCAG 2.x contrast ratio — older standard, shown for reference."><strong style="color: var(--text-tertiary)">WCAG 2.x</strong> info</span>
								<span>·</span>
								<span title="Standard = default text pairing for the shade's intended mode. Inverse = opposite mode."><strong style="color: var(--text-tertiary)">Standard</strong> / <strong style="color: var(--text-tertiary)">Inverse</strong> pairings</span>
								<button
									class="text-[10px] font-body px-1.5 py-0.5 rounded cursor-pointer transition-all hover:opacity-70"
									style="color: var(--text-ghost)"
									title="Dismiss card legend"
									onclick={() => { legendDismissed = true; saveLegendDismissed(true); }}
								>✕</button>
							</div>
						{:else}
							<button
								class="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-body font-600 cursor-pointer transition-all hover:opacity-80"
								style="background: rgba(255,255,255,0.06); color: var(--text-ghost)"
								title="Show card legend: Readability (APCA Lc) = primary contrast metric · WCAG 2.x = informational · Standard/Inverse = text pairings"
								onclick={() => { legendDismissed = false; saveLegendDismissed(false); }}
							>i</button>
						{/if}
					</div>

					<!-- Cards -->
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
						{#each currentScale.shades as shade, i (shade.shade)}
							<div class="shade-card-enter h-full" style="animation-delay: {i * 50}ms">
								<ShadeCard {shade} />
							</div>
						{/each}
					</div>

					<!-- Scale gradient strip -->
					<div class="mt-3">
						<GradientStrip hexes={currentScale.shades.map((s) => s.hex)} height={16} />
					</div>

					<!-- Lightness normalisation note -->
					{#if currentScale.shades[3]?.wasLAdjusted}
						<div
							class="mt-4 px-4 py-3 rounded-xl text-[13px] font-body"
							style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); color: var(--text-tertiary)"
						>
							<strong style="color: var(--text-secondary)">Lightness normalised:</strong> Your input's L* was {currentScale.shades[3].originalL.toFixed(3)} — the 300 shade is generated at the optimal L* {currentScale.shades[3].oklch.L.toFixed(3)} for readability compliance. Hue and chroma are preserved from your input.
						</div>
					{/if}
				{/key}

				<!-- Scale preview — token usage + colour blindness -->
				<details class="mt-4 group">
					<summary
						class="flex items-center gap-2.5 px-4 py-3 rounded-xl cursor-pointer select-none font-body text-[13px] font-500 transition-all duration-200 interactive-surface"
						style="background: var(--surface-1); border: 1px solid var(--border-subtle); color: var(--text-secondary)"
					>
						<svg class="w-3 h-3 transition-transform duration-300 group-open:rotate-90" style="color: var(--text-ghost)" viewBox="0 0 16 16" fill="currentColor">
							<path d="M6 3l5 5-5 5V3z"/>
						</svg>
						Preview &amp; Colour Blindness
						<span class="font-400 text-[11px] ml-1" style="color: var(--text-ghost)">Material 3 Expressive &middot; CVD simulation</span>
						<span class="flex-1"></span>
						<kbd class="group-open:hidden">expand</kbd>
					</summary>
					<div class="mt-2">
						<ScalePreview scale={currentScale} />
					</div>
				</details>
			{:else}
				<!-- Empty state — shown when we have families but no scale yet -->
				<div
					class="relative flex flex-col items-center justify-center py-16 rounded-2xl gap-4 fade-in overflow-hidden"
					style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
				>
					<div
						class="absolute inset-0 pointer-events-none"
						style="background: radial-gradient(ellipse 60% 50% at 50% 30%, rgba(139,92,246,0.06) 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 30% 60%, rgba(34,211,238,0.04) 0%, transparent 50%), radial-gradient(ellipse 50% 50% at 70% 60%, rgba(245,158,11,0.04) 0%, transparent 50%)"
					></div>
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
					<div class="relative flex flex-col items-center gap-1">
						<p class="text-[16px] font-display font-600" style="color: var(--text-primary)">
							Enter a hex colour above to generate a scale
						</p>
						<p class="text-[13px] font-body" style="color: var(--text-tertiary)">
							Or click any family in the palette analysis below
						</p>
					</div>
				</div>
			{/if}
		</svelte:boundary>
		</section>

		<!-- Palette Analysis — Upload, Compare, Audit (unified section) -->
		<section id="palette" class="mb-8 scroll-mt-16 section-reveal">
		<svelte:boundary onerror={(e) => console.error('Palette analysis error:', e)}>
			{#snippet failed(error, reset)}
				<div class="px-5 py-6 rounded-2xl text-center" style="background: var(--surface-1); border: 1px solid rgba(239,68,68,0.2)">
					<p class="font-body text-[14px] font-500 mb-2" style="color: rgba(239,68,68,0.8)">Something went wrong with the palette analysis</p>
					<p class="font-mono text-[12px] mb-3" style="color: var(--text-tertiary)">{error instanceof Error ? error.message : String(error)}</p>
					<button onclick={() => { clearComparison(); reset(); }} class="font-body text-[13px] font-500 px-4 py-2 rounded-lg cursor-pointer" style="background: rgba(255,255,255,0.08); color: var(--text-secondary)">Reset</button>
				</div>
			{/snippet}
			<div class="flex items-center gap-3 mb-3">
				<p class="section-heading font-display text-[12px] font-600 uppercase tracking-[0.10em]" style="color: var(--text-secondary)">
					Palette Analysis
				</p>
				<div class="flex-1 h-px" style="background: var(--border-subtle)"></div>
			{#if allFamilies.length > 0}
				<p class="font-body text-[12px]" style="color: var(--text-tertiary)">
					{allFamilies.length} {allFamilies.length === 1 ? 'family' : 'families'}{comparisonFamilies.length > 0 ? ' loaded' : ' in workspace'} &middot; click a family to generate
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
							border-bottom: 2px dashed {isDragging ? 'rgba(34,211,238,0.5)' : 'var(--border-medium)'};
							background: {isDragging ? 'rgba(34,211,238,0.04)' : 'transparent'};
						"
						role="region"
						aria-label="File drop zone"
						ondragover={(e) => { e.preventDefault(); isDragging = true; }}
						ondragleave={() => (isDragging = false)}
						ondrop={handleComparisonDrop}
					>
						<div class="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
							<div class="flex items-center gap-4 flex-1">
								<svg class="shrink-0 opacity-25" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
								</svg>
								<div class="text-center sm:text-left">
									<p class="font-body text-[14px] font-500" style="color: var(--text-primary)">
										Upload your Figma token export
									</p>
									<p class="font-body text-[13px] mt-1" style="color: var(--text-tertiary)">
										Drop <code class="font-mono text-[11px] px-1 py-0.5 rounded" style="background: var(--surface-2)">.json</code> files here (primitives + semantic), or
										<label class="cursor-pointer underline underline-offset-2 transition-opacity hover:opacity-70" style="color: var(--text-secondary)">
											browse
											<input type="file" accept=".json" multiple class="sr-only" onchange={handleComparisonFileInput} />
										</label>
									</p>
								</div>
							</div>
							<div class="shrink-0 text-[12px] font-body" style="color: var(--text-ghost)">
								Analyses, compares, and audits your colour palette
							</div>
						</div>
					</div>

					<div class="p-5 space-y-3">
						<textarea
							bind:value={comparisonJsonInput}
							placeholder="Or paste JSON contents here..."
							class="w-full h-24 px-4 py-3 rounded-xl font-mono text-[12px] resize-y transition-all focus-visible:ring-1 focus-visible:ring-white/20"
							style="background: var(--surface-2); border: 1px solid var(--border-subtle); color: var(--text-primary); outline: none;"
						></textarea>
						<button
							onclick={handleComparisonParse}
							class="cta-glow font-body text-[13px] font-500 px-5 py-2.5 rounded-xl cursor-pointer"
							style="background: {accentColor}; color: white; --cta-glow-color: {accentColor}40"
						>
							Analyse Tokens
						</button>
					</div>
				</div>
			{:else}
				<!-- Toolbar when tokens are loaded -->
				<div
					class="rounded-2xl overflow-hidden mb-5"
					style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
				>
					<div class="flex items-center justify-between flex-wrap gap-2 px-5 py-3.5">
						<div class="flex items-center gap-3">
							<p class="font-body text-[13px]" style="color: var(--text-secondary)">
								Click a family to load into generator
							</p>
							{#if semanticResults.length > 0}
								<span class="text-[10px] font-body font-600 px-2 py-0.5 rounded-md" style="background: rgba(16,185,129,0.08); color: #10b981">
									{semanticResults.map((r) => r.label).join(' + ')} semantic loaded
								</span>
							{/if}
						</div>
						<div class="flex items-center gap-2">
							{#if semanticResults.length === 0}
								<label
									class="font-body text-[13px] font-500 px-3.5 py-1.5 rounded-lg cursor-pointer transition-all duration-200 hover:opacity-80"
									style="background: rgba(139,92,246,0.08); color: rgba(167,139,250,0.9)"
									title="Upload Light.tokens.json and/or Dark.tokens.json to analyse which primitives are used"
								>
									+ Semantic tokens
									<input type="file" accept=".json" multiple class="sr-only" onchange={handleComparisonFileInput} />
								</label>
							{/if}
							<button
								onclick={clearComparison}
								class="font-body text-[13px] font-500 px-3.5 py-1.5 rounded-lg cursor-pointer transition-all duration-200 hover:opacity-80"
								style="background: rgba(255,255,255,0.06); color: var(--text-tertiary)"
							>
								Replace JSON
							</button>
						</div>
					</div>
				</div>
			{/if}

			<!-- Comparison view — shows all families (uploaded + workspace), sorted by hue -->
			{#if allFamilies.length > 0}
				<div
					class="rounded-2xl overflow-hidden"
					style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
				>
					<div class="p-5">
						<ComparisonView
							families={allFamilies}
							{audit}
							onSelectFamily={handleSelectFamily}
							{lockedFamilies}
							onToggleLock={handleToggleLock}
							onRemoveFamily={handleRemoveWorkspaceFamily}
							onAcceptProposed={handleAcceptProposed}
						/>
					</div>
				</div>
			{/if}

			<!-- APCA Compliance Matrix — visible when any families exist (uploaded or workspace) -->
			{#if allFamilies.length > 0}
				<div id="apca-matrix" class="mt-6 scroll-mt-16">
					<ApcaMatrix families={allFamilies} {lockedFamilies} onRemoveFamily={handleRemoveWorkspaceFamily} />
				</div>
			{/if}

			<!-- Hue collisions + Suggested additions (palette-wide insights) -->
			{#if audit && (audit.proximityWarnings.length > 0 || audit.gapSuggestions.length > 0)}
				<div id="suggestions" class="mt-6 scroll-mt-16"></div>
				<PaletteAuditPanel
					{audit}
					onSelectFamily={handleSelectFamily}
					onAddToWorkspace={handleAddToWorkspaceDirect}
				/>
			{/if}

			<!-- Neutral Scales — achromatic family analysis -->
			{#if achromaticFamilies.length > 0}
				<div id="neutrals" class="mt-6 scroll-mt-16 section-reveal" style="animation-delay: 100ms">
					<div class="flex items-center gap-3 mb-3">
						<p class="section-heading font-display text-[12px] font-600 uppercase tracking-[0.10em]" style="color: var(--text-secondary)">
							Neutral Scales
						</p>
						<div class="flex-1 h-px" style="background: var(--border-subtle)"></div>
						<p class="font-body text-[12px]" style="color: var(--text-tertiary)">
							{achromaticFamilies.length} neutral {achromaticFamilies.length === 1 ? 'family' : 'families'} · lightness analysis and consolidation
						</p>
					</div>
					<NeutralAnalysis families={achromaticFamilies} />
				</div>
			{/if}

			<!-- Primitive Coverage — semantic token cross-reference -->
			{#if coverageAnalysis}
				<div id="coverage" class="mt-6 scroll-mt-16 section-reveal" style="animation-delay: 150ms">
					<div class="flex items-center gap-3 mb-3">
						<p class="section-heading font-display text-[12px] font-600 uppercase tracking-[0.10em]" style="color: var(--text-secondary)">
							Semantic Coverage
						</p>
						<div class="flex-1 h-px" style="background: var(--border-subtle)"></div>
						<p class="font-body text-[12px]" style="color: var(--text-tertiary)">
							Which primitives are referenced by your semantic tokens
						</p>
					</div>
					<PrimitiveCoverage coverage={coverageAnalysis} onClear={clearSemanticOnly} />
				</div>
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

		{/if}
		<!-- end two-lane / normal mode conditional -->

	</main>

	<!-- Footer -->
	<footer class="chromatic-footer mt-8 py-8">
		<div class="max-w-[1600px] mx-auto px-6 lg:px-10">
			<div class="flex flex-col sm:flex-row items-center justify-between gap-4">
				<div class="flex items-center gap-3">
					<svg viewBox="0 0 32 32" width="20" height="20" fill="none" style="opacity: 0.4">
						<path
							d="M22 6.5A11.5 11.5 0 1 0 22 25.5"
							stroke="url(#chromatic-grad)"
							stroke-width="3"
							stroke-linecap="round"
						/>
					</svg>
					<span class="font-display text-[13px] font-500" style="color: var(--text-ghost)">
						Chromatic
					</span>
					<span class="text-[11px] font-mono" style="color: var(--text-ghost); opacity: 0.5">
						v1.0
					</span>
				</div>
				<div class="flex items-center gap-4 text-[11px] font-body" style="color: var(--text-ghost)">
					<span>Oklch · APCA · Perceptual colour science</span>
					<span style="opacity: 0.3">·</span>
					<span style="opacity: 0.6">Built for design systems</span>
				</div>
			</div>
		</div>
	</footer>
</div>
