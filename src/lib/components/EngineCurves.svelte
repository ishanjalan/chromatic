<script lang="ts">
	import { hexToRgb, rgbToOklch } from '../colour';

	interface ShadePoint {
		shade: number;
		existingHex: string;
		proposedHex: string;
	}

	let {
		shades,
		familyName = ''
	}: {
		shades: ShadePoint[];
		familyName?: string;
	} = $props();

	function hexToOklch(hex: string) {
		const { r, g, b } = hexToRgb(hex);
		return rgbToOklch(r, g, b);
	}

	let points = $derived(shades.map((s) => {
		const eOklch = hexToOklch(s.existingHex);
		const pOklch = hexToOklch(s.proposedHex);
		return {
			shade: s.shade,
			eL: eOklch.L,
			eC: eOklch.C,
			eH: eOklch.H,
			pL: pOklch.L,
			pC: pOklch.C,
			pH: pOklch.H,
		};
	}));

	const W = 200;
	const H = 80;
	const PAD_L = 0;
	const PAD_R = 0;
	const PAD_T = 6;
	const PAD_B = 6;
	const plotW = W - PAD_L - PAD_R;
	const plotH = H - PAD_T - PAD_B;

	function buildPath(
		pts: typeof points,
		accessor: (p: typeof points[0]) => number,
		minVal: number,
		maxVal: number,
	): string {
		if (pts.length < 2) return '';
		const range = maxVal - minVal || 1;
		return pts.map((p, i) => {
			const x = PAD_L + (i / (pts.length - 1)) * plotW;
			const y = PAD_T + plotH - ((accessor(p) - minVal) / range) * plotH;
			return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
		}).join(' ');
	}

	function buildArea(
		pts: typeof points,
		accessor: (p: typeof points[0]) => number,
		minVal: number,
		maxVal: number,
	): string {
		if (pts.length < 2) return '';
		const range = maxVal - minVal || 1;
		const top = pts.map((p, i) => {
			const x = PAD_L + (i / (pts.length - 1)) * plotW;
			const y = PAD_T + plotH - ((accessor(p) - minVal) / range) * plotH;
			return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
		}).join(' ');
		const lastX = PAD_L + plotW;
		const firstX = PAD_L;
		const bottom = PAD_T + plotH;
		return `${top} L ${lastX.toFixed(1)} ${bottom.toFixed(1)} L ${firstX.toFixed(1)} ${bottom.toFixed(1)} Z`;
	}

	function dotPositions(
		pts: typeof points,
		accessor: (p: typeof points[0]) => number,
		minVal: number,
		maxVal: number,
	) {
		const range = maxVal - minVal || 1;
		return pts.map((p, i) => ({
			x: PAD_L + (i / (pts.length - 1)) * plotW,
			y: PAD_T + plotH - ((accessor(p) - minVal) / range) * plotH,
			val: accessor(p),
			shade: p.shade,
		}));
	}

	// L range: always 0–1
	const L_MIN = 0;
	const L_MAX = 1;

	let cMin = $derived(Math.max(0, Math.min(...points.map(p => Math.min(p.eC, p.pC))) - 0.02));
	let cMax = $derived(Math.max(...points.map(p => Math.max(p.eC, p.pC))) + 0.02);

	let existingLPath = $derived(buildPath(points, p => p.eL, L_MIN, L_MAX));
	let proposedLPath = $derived(buildPath(points, p => p.pL, L_MIN, L_MAX));
	let proposedLArea = $derived(buildArea(points, p => p.pL, L_MIN, L_MAX));
	let existingLDots = $derived(dotPositions(points, p => p.eL, L_MIN, L_MAX));
	let proposedLDots = $derived(dotPositions(points, p => p.pL, L_MIN, L_MAX));

	let existingCPath = $derived(buildPath(points, p => p.eC, cMin, cMax));
	let proposedCPath = $derived(buildPath(points, p => p.pC, cMin, cMax));
	let proposedCArea = $derived(buildArea(points, p => p.pC, cMin, cMax));
	let existingCDots = $derived(dotPositions(points, p => p.eC, cMin, cMax));
	let proposedCDots = $derived(dotPositions(points, p => p.pC, cMin, cMax));

	const gridLines = [0.25, 0.5, 0.75];
</script>

<div class="flex gap-5 items-start">
	<!-- Lightness curve -->
	<div class="flex flex-col gap-1">
		<div class="flex items-center gap-1.5 mb-0.5">
			<span class="font-mono text-[9px] font-600 uppercase tracking-wider" style="color: var(--text-ghost)">Lightness</span>
		</div>
		<svg width={W} height={H} viewBox="0 0 {W} {H}" class="chart-svg">
			{#each gridLines as frac}
				{@const gy = PAD_T + plotH - frac * plotH}
				<line x1={PAD_L} y1={gy} x2={PAD_L + plotW} y2={gy} stroke="rgba(255,255,255,0.04)" stroke-width="0.5" />
			{/each}

			<path d={proposedLArea} fill="rgba(139,92,246,0.06)" />
			<path d={existingLPath} fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-dasharray="4 3" />
			<path d={proposedLPath} fill="none" stroke="rgba(139,92,246,0.7)" stroke-width="1.5" />

			{#each existingLDots as dot}
				<circle cx={dot.x} cy={dot.y} r="2.5" fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.12)" stroke-width="0.5">
					<title>{dot.shade}: L = {dot.val.toFixed(3)}</title>
				</circle>
			{/each}
			{#each proposedLDots as dot}
				<circle cx={dot.x} cy={dot.y} r="2.5" fill="rgba(139,92,246,0.85)" stroke="rgba(255,255,255,0.2)" stroke-width="0.5">
					<title>{dot.shade}: L = {dot.val.toFixed(3)}</title>
				</circle>
			{/each}
		</svg>
		<div class="flex justify-between px-0.5" style="width: {W}px">
			{#each points as p}
				<span class="font-mono text-[8px]" style="color: var(--text-ghost)">{p.shade}</span>
			{/each}
		</div>
	</div>

	<!-- Chroma curve -->
	<div class="flex flex-col gap-1">
		<div class="flex items-center gap-1.5 mb-0.5">
			<span class="font-mono text-[9px] font-600 uppercase tracking-wider" style="color: var(--text-ghost)">Chroma</span>
		</div>
		<svg width={W} height={H} viewBox="0 0 {W} {H}" class="chart-svg">
			{#each gridLines as frac}
				{@const gy = PAD_T + plotH - frac * plotH}
				<line x1={PAD_L} y1={gy} x2={PAD_L + plotW} y2={gy} stroke="rgba(255,255,255,0.04)" stroke-width="0.5" />
			{/each}

			<path d={proposedCArea} fill="rgba(34,211,238,0.06)" />
			<path d={existingCPath} fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-dasharray="4 3" />
			<path d={proposedCPath} fill="none" stroke="rgba(34,211,238,0.7)" stroke-width="1.5" />

			{#each existingCDots as dot}
				<circle cx={dot.x} cy={dot.y} r="2.5" fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.12)" stroke-width="0.5">
					<title>{dot.shade}: C = {dot.val.toFixed(3)}</title>
				</circle>
			{/each}
			{#each proposedCDots as dot}
				<circle cx={dot.x} cy={dot.y} r="2.5" fill="rgba(34,211,238,0.85)" stroke="rgba(255,255,255,0.2)" stroke-width="0.5">
					<title>{dot.shade}: C = {dot.val.toFixed(3)}</title>
				</circle>
			{/each}
		</svg>
		<div class="flex justify-between px-0.5" style="width: {W}px">
			{#each points as p}
				<span class="font-mono text-[8px]" style="color: var(--text-ghost)">{p.shade}</span>
			{/each}
		</div>
	</div>
</div>

<!-- Legend -->
<div class="flex items-center gap-4 mt-1.5">
	<div class="flex items-center gap-1.5">
		<svg width="16" height="2"><line x1="0" y1="1" x2="16" y2="1" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-dasharray="4 3" /></svg>
		<span class="text-[9px] font-mono" style="color: var(--text-ghost)">Existing</span>
	</div>
	<div class="flex items-center gap-1.5">
		<svg width="16" height="3">
			<rect x="0" y="0" width="16" height="3" rx="1" fill="rgba(139,92,246,0.7)" />
		</svg>
		<span class="text-[9px] font-mono" style="color: var(--text-ghost)">Proposed L</span>
	</div>
	<div class="flex items-center gap-1.5">
		<svg width="16" height="3">
			<rect x="0" y="0" width="16" height="3" rx="1" fill="rgba(34,211,238,0.7)" />
		</svg>
		<span class="text-[9px] font-mono" style="color: var(--text-ghost)">Proposed C</span>
	</div>
</div>

<style>
	.chart-svg {
		border-radius: 6px;
		background: rgba(255,255,255,0.015);
		border: 1px solid rgba(255,255,255,0.04);
	}
</style>
