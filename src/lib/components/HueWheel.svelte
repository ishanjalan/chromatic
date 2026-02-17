<script lang="ts">
	export interface HueDot {
		name: string;
		hue: number;
		hex: string;
		source: 'uploaded' | 'generated' | 'suggestion';
	}

	let {
		dots = [],
		generatedHue = null
	}: {
		dots?: HueDot[];
		generatedHue?: number | null;
	} = $props();

	const SIZE = 220;
	const CX = SIZE / 2;
	const CY = SIZE / 2;
	const OUTER_R = 96;
	const INNER_R = 72;
	const MID_R = (OUTER_R + INNER_R) / 2;
	const DOT_R = 6;
	const GEN_DOT_R = 9;
	const SUG_DOT_R = 5;

	function hueToXY(hue: number, radius: number) {
		const rad = ((hue - 90) * Math.PI) / 180;
		return {
			x: CX + radius * Math.cos(rad),
			y: CY + radius * Math.sin(rad)
		};
	}

	const conicStops = Array.from({ length: 36 }, (_, i) => {
		const h = i * 10;
		return `oklch(0.65 0.12 ${h}) ${h}deg`;
	}).join(', ');

	let uploadedDots = $derived(dots.filter(d => d.source === 'uploaded'));
	let suggestionDots = $derived(dots.filter(d => d.source === 'suggestion'));
</script>

<div class="flex justify-center">
	<svg
		width={SIZE}
		height={SIZE}
		viewBox="0 0 {SIZE} {SIZE}"
	>
		<defs>
			<clipPath id="ring-clip">
				<path d="
					M {CX} {CY - OUTER_R}
					A {OUTER_R} {OUTER_R} 0 1 1 {CX} {CY + OUTER_R}
					A {OUTER_R} {OUTER_R} 0 1 1 {CX} {CY - OUTER_R}
					Z
					M {CX} {CY - INNER_R}
					A {INNER_R} {INNER_R} 0 1 0 {CX} {CY + INNER_R}
					A {INNER_R} {INNER_R} 0 1 0 {CX} {CY - INNER_R}
					Z
				" fill-rule="evenodd" />
			</clipPath>

			{#if generatedHue !== null}
				<filter id="gen-glow" x="-100%" y="-100%" width="300%" height="300%">
					<feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			{/if}
		</defs>

		<!-- Hue ring background -->
		<foreignObject x={CX - OUTER_R} y={CY - OUTER_R} width={OUTER_R * 2} height={OUTER_R * 2} clip-path="url(#ring-clip)">
			<div
				xmlns="http://www.w3.org/1999/xhtml"
				style="width: 100%; height: 100%; border-radius: 50%; background: conic-gradient(from 0deg, {conicStops}); opacity: 0.3;"
			></div>
		</foreignObject>

		<circle cx={CX} cy={CY} r={OUTER_R} fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
		<circle cx={CX} cy={CY} r={INNER_R} fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1" />

		<!-- Suggestion dots (dashed rings, behind everything) -->
		{#each suggestionDots as dot}
			{@const pos = hueToXY(dot.hue, MID_R)}
			<circle
				cx={pos.x}
				cy={pos.y}
				r={SUG_DOT_R}
				fill="none"
				stroke={dot.hex}
				stroke-width="1.5"
				stroke-dasharray="2 2"
				opacity="0.6"
			>
				<title>Suggestion: {dot.name} — {dot.hue.toFixed(0)}°</title>
			</circle>
		{/each}

		<!-- Uploaded family dots (solid filled) -->
		{#each uploadedDots as dot}
			{@const pos = hueToXY(dot.hue, MID_R)}
			<circle
				cx={pos.x}
				cy={pos.y}
				r={DOT_R}
				fill={dot.hex}
				stroke="rgba(0,0,0,0.3)"
				stroke-width="1.5"
			>
				<title>{dot.name} — {dot.hue.toFixed(0)}°</title>
			</circle>
		{/each}

		<!-- Generated hue marker (white ring with glow) -->
		{#if generatedHue !== null}
			{@const gpos = hueToXY(generatedHue, MID_R)}
			<circle cx={gpos.x} cy={gpos.y} r={GEN_DOT_R + 4} fill="rgba(255,255,255,0.08)" class="glow-pulse" />
			<circle cx={gpos.x} cy={gpos.y} r={GEN_DOT_R} fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2" filter="url(#gen-glow)" />
			<circle cx={gpos.x} cy={gpos.y} r={3.5} fill="rgba(255,255,255,0.9)" />
		{/if}

		<!-- Centre label -->
		<text x={CX} y={CY - 4} text-anchor="middle" font-family="var(--font-mono)" font-size="14" fill="rgba(255,255,255,0.65)">
			{generatedHue !== null ? `${generatedHue.toFixed(0)}°` : '—'}
		</text>
		<text x={CX} y={CY + 12} text-anchor="middle" font-family="var(--font-display)" font-size="11" fill="rgba(255,255,255,0.45)" letter-spacing="0.08em">
			HUE
		</text>
	</svg>
</div>
