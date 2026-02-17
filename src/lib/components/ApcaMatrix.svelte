<script lang="ts">
	/**
	 * ApcaMatrix — palette-wide APCA compliance heatmap.
	 *
	 * Rows = shade levels (50–500), Columns = colour families.
	 * Each cell shows the shade's hex background with its APCA Lc value,
	 * colour-coded green/amber/red by pass/fail status.
	 *
	 * Supports toggling between Existing (uploaded token values) and
	 * Proposed (generated scale values) to compare compliance.
	 */

	import { generateScale } from '$lib/scale';
	import type { ScaleResult } from '$lib/scale';
	import { hexToRgb, apcaContrast, relativeLuminance } from '$lib/colour';
	import { SHADE_LEVELS, SHADE_ACTIVE_TEXT } from '$lib/constants';
	import type { ParsedFamily } from '$lib/parse-tokens';

	let {
		families,
		lockedFamilies = new Set<string>(),
		onRemoveFamily
	}: {
		families: ParsedFamily[];
		lockedFamilies?: Set<string>;
		onRemoveFamily?: (familyName: string) => void;
	} = $props();

	const G750 = { r: 0.1137, g: 0.1137, b: 0.1137 };
	const G50 = { r: 0.9922, g: 0.9922, b: 0.9922 };

	type ViewMode = 'proposed' | 'existing';
	let viewMode = $state<ViewMode>('proposed');

	interface MatrixCell {
		hex: string;
		lc: number;
		pass: boolean;
		marginal: boolean;
		textColor: string;
	}

	interface FamilyColumn {
		name: string;
		hex300: string;
		source: 'token' | 'workspace';
		existingCells: Map<number, MatrixCell>;
		proposedCells: Map<number, MatrixCell>;
		existingPassCount: number;
		proposedPassCount: number;
	}

	function computeCell(hex: string, shade: number): MatrixCell {
		const { r, g, b } = hexToRgb(hex);
		const textToken = SHADE_ACTIVE_TEXT[shade] === 'grey750' ? G750 : G50;
		const lc = Math.abs(apcaContrast(textToken.r, textToken.g, textToken.b, r, g, b));
		const lum = relativeLuminance(r, g, b);
		const textColor = lum > 0.18 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)';
		return {
			hex,
			lc,
			pass: lc >= 60,
			marginal: lc >= 45 && lc < 60,
			textColor
		};
	}

	let columns = $derived.by<FamilyColumn[]>(() => {
		return families
			.filter((f) => f.shades[300])
			.map((fam) => {
				const hex300 = fam.shades[300];
				const scale = generateScale(hex300, fam.name);

				const existingCells = new Map<number, MatrixCell>();
				const proposedCells = new Map<number, MatrixCell>();
				let existingPassCount = 0;
				let proposedPassCount = 0;

				for (const shade of SHADE_LEVELS) {
					// Proposed (generated)
					const proposedShade = scale.shades.find((s) => s.shade === shade);
					if (proposedShade) {
						const pCell = computeCell(proposedShade.hex, shade);
						proposedCells.set(shade, pCell);
						if (pCell.pass) proposedPassCount++;
					}

					// Existing (uploaded token)
					const existingHex = fam.shades[shade];
					if (existingHex) {
						const eCell = computeCell(existingHex, shade);
						existingCells.set(shade, eCell);
						if (eCell.pass) existingPassCount++;
					}
				}

				return { name: fam.name, hex300, source: (fam.source ?? 'token') as 'token' | 'workspace', existingCells, proposedCells, existingPassCount, proposedPassCount };
			});
	});

	let activeCells = $derived(
		columns.map((col) => ({
			...col,
			cells: viewMode === 'proposed' ? col.proposedCells : col.existingCells,
			passCount: viewMode === 'proposed' ? col.proposedPassCount : col.existingPassCount
		}))
	);

	let totalPass = $derived(activeCells.reduce((a, c) => a + c.passCount, 0));
	let totalCells = $derived(activeCells.length * SHADE_LEVELS.length);

	let existingTotalPass = $derived(columns.reduce((a, c) => a + c.existingPassCount, 0));
	let proposedTotalPass = $derived(columns.reduce((a, c) => a + c.proposedPassCount, 0));
	let improvement = $derived(proposedTotalPass - existingTotalPass);

	let collapsed = $state(false);
</script>

{#if columns.length > 0}
<div
	class="rounded-xl overflow-hidden"
	style="background: var(--surface-1); border: 1px solid var(--border-subtle)"
>
	<!-- Header -->
	<button
		class="w-full flex items-center justify-between px-5 py-3 cursor-pointer"
		style="background: var(--surface-0)"
		onclick={() => collapsed = !collapsed}
	>
		<div class="flex items-center gap-3">
			<span class="font-display text-[13px] font-600" style="color: var(--text-primary)">
				APCA Compliance Matrix
			</span>
			<span
				class="text-[10px] font-mono font-600 px-2 py-0.5 rounded-md"
				style="background: {totalPass === totalCells ? 'rgba(16,185,129,0.10)' : 'rgba(245,158,11,0.10)'}; color: {totalPass === totalCells ? '#10b981' : '#f59e0b'}"
			>
				{totalPass}/{totalCells} pass
			</span>
			{#if improvement !== 0}
				<span
					class="text-[10px] font-mono font-500 px-1.5 py-0.5 rounded-md"
					style="background: {improvement > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'}; color: {improvement > 0 ? '#10b981' : '#ef4444'}"
				>
					{improvement > 0 ? '+' : ''}{improvement} vs existing
				</span>
			{/if}
		</div>
		<span
			class="text-[12px] transition-transform duration-200"
			style="color: var(--text-ghost); transform: rotate({collapsed ? '-90deg' : '0deg'})"
		>&#9660;</span>
	</button>

	{#if !collapsed}
	<!-- View mode toggle -->
	<div class="flex items-center gap-1 px-5 py-2" style="border-bottom: 1px solid var(--border-subtle)">
		<button
			class="font-body text-[11px] font-500 px-3 py-1 rounded-md cursor-pointer transition-all duration-150"
			style="background: {viewMode === 'existing' ? 'rgba(255,255,255,0.08)' : 'transparent'}; color: {viewMode === 'existing' ? 'var(--text-primary)' : 'var(--text-ghost)'}"
			onclick={() => viewMode = 'existing'}
		>
			Existing
			<span class="font-mono text-[10px] ml-1" style="opacity: 0.6">{existingTotalPass}/{totalCells}</span>
		</button>
		<button
			class="font-body text-[11px] font-500 px-3 py-1 rounded-md cursor-pointer transition-all duration-150"
			style="background: {viewMode === 'proposed' ? 'rgba(255,255,255,0.08)' : 'transparent'}; color: {viewMode === 'proposed' ? 'var(--text-primary)' : 'var(--text-ghost)'}"
			onclick={() => viewMode = 'proposed'}
		>
			Proposed
			<span class="font-mono text-[10px] ml-1" style="opacity: 0.6">{proposedTotalPass}/{totalCells}</span>
		</button>
	</div>

	<div class="overflow-x-auto">
		<table class="w-full border-collapse" style="min-width: {activeCells.length * 80 + 100}px">
			<!-- Column headers: family names -->
			<thead>
				<tr>
					<th
						class="sticky left-0 z-10 px-3 py-2 text-left font-body text-[10px] font-500"
						style="background: var(--surface-1); color: var(--text-ghost); width: 100px"
					>
						Shade
					</th>
					{#each activeCells as col}
						<th class="px-1 py-2 text-center" style="min-width: 72px">
							<div class="flex flex-col items-center gap-1">
								<div class="relative">
									<div
										class="w-5 h-5 rounded"
										style="background: {col.hex300}; box-shadow: 0 1px 4px rgba(0,0,0,0.3)"
									></div>
									{#if col.source === 'workspace' && onRemoveFamily}
										<button
											class="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center cursor-pointer text-[7px] font-700 leading-none"
											style="background: rgba(239,68,68,0.8); color: white"
											title="Remove {col.name} from workspace"
											onclick={() => onRemoveFamily(col.name)}
										>✕</button>
									{/if}
								</div>
								<span
									class="font-body text-[10px] font-500 truncate max-w-[72px]"
									style="color: var(--text-secondary)"
								>{col.name}</span>
								{#if col.source === 'workspace'}
									<span
										class="text-[7px] font-body font-600 px-1 rounded"
										style="background: rgba(139,92,246,0.12); color: rgba(167,139,250,0.9)"
									>added</span>
								{/if}
							</div>
						</th>
					{/each}
				</tr>
			</thead>

			<!-- Shade rows -->
			<tbody>
				{#each SHADE_LEVELS as shade}
					{@const textToken = SHADE_ACTIVE_TEXT[shade]}
					<tr>
						<td
							class="sticky left-0 z-10 px-3 py-1.5 font-mono text-[11px] font-500"
							style="background: var(--surface-1); color: var(--text-tertiary)"
						>
							<div class="flex items-center gap-1.5">
								<span>{shade}</span>
								<span
									class="text-[9px] font-body font-400 px-1 py-px rounded"
									style="background: rgba(255,255,255,0.04); color: var(--text-ghost)"
								>{textToken === 'grey750' ? 'G750' : 'G50'}</span>
							</div>
						</td>
						{#each activeCells as col}
							{@const cell = col.cells.get(shade)}
							{#if cell}
								<td class="px-1 py-1">
									<div
										class="relative flex flex-col items-center justify-center rounded-md px-1 py-1.5"
										style="background: {cell.hex}; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06), 0 0 0 1.5px {cell.pass ? 'rgba(16,185,129,0.3)' : cell.marginal ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.35)'};"
										title="{col.name}/{shade}: Lc {cell.lc.toFixed(1)} ({cell.pass ? 'Pass' : cell.marginal ? 'Marginal' : 'Fail'}) — tested against {textToken === 'grey750' ? 'Grey 750 (#1D1D1D)' : 'Grey 50 (#FDFDFD)'}"
									>
										<span
											class="font-mono text-[11px] font-700 leading-tight"
											style="color: {cell.textColor}"
										>{Math.round(cell.lc)}</span>
										<span
											class="font-mono text-[8px] font-500 leading-tight"
											style="color: {cell.textColor}; opacity: 0.6"
										>{cell.pass ? 'pass' : cell.marginal ? 'marg' : 'fail'}</span>
									</div>
								</td>
							{:else}
								<td class="px-1 py-1">
									<div
										class="flex items-center justify-center rounded-md px-1 py-1.5"
										style="background: rgba(255,255,255,0.03); min-height: 36px"
									>
										<span class="font-mono text-[9px]" style="color: var(--text-ghost)">—</span>
									</div>
								</td>
							{/if}
						{/each}
					</tr>
				{/each}
			</tbody>

			<!-- Summary row -->
			<tfoot>
				<tr>
					<td
						class="sticky left-0 z-10 px-3 py-2 font-body text-[10px] font-600"
						style="background: var(--surface-1); color: var(--text-tertiary)"
					>
						Pass rate
					</td>
					{#each activeCells as col}
						<td class="px-1 py-2 text-center">
							<span
								class="font-mono text-[11px] font-600 px-2 py-0.5 rounded-md"
								style="background: {col.passCount === SHADE_LEVELS.length ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)'}; color: {col.passCount === SHADE_LEVELS.length ? '#10b981' : '#ef4444'}"
							>{col.passCount}/{SHADE_LEVELS.length}</span>
						</td>
					{/each}
				</tr>
			</tfoot>
		</table>
	</div>

	<!-- Legend -->
	<div class="flex items-center gap-4 px-5 py-2.5" style="border-top: 1px solid var(--border-subtle)">
		<span class="font-body text-[10px]" style="color: var(--text-ghost)">
			Lc values tested against the active text token per shade (Grey 750 for light fills, Grey 50 for dark fills)
		</span>
		<div class="flex items-center gap-3 ml-auto shrink-0">
			<div class="flex items-center gap-1">
				<div class="w-2 h-2 rounded-full" style="background: #10b981"></div>
				<span class="font-body text-[9px]" style="color: var(--text-ghost)">Lc ≥ 60</span>
			</div>
			<div class="flex items-center gap-1">
				<div class="w-2 h-2 rounded-full" style="background: #f59e0b"></div>
				<span class="font-body text-[9px]" style="color: var(--text-ghost)">Lc 45–59</span>
			</div>
			<div class="flex items-center gap-1">
				<div class="w-2 h-2 rounded-full" style="background: #ef4444"></div>
				<span class="font-body text-[9px]" style="color: var(--text-ghost)">Lc &lt; 45</span>
			</div>
		</div>
	</div>
	{/if}
</div>
{/if}
