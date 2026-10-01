<script lang="ts">
	/**
	 * A city's residents in 20 steps of 5%, worst served first. Each bar is what
	 * that 5% has — minutes to a park, m² per person, hectares of green —
	 * coloured as on the map and set against the target, dashed.
	 */
	import { max, range, scaleBand, scaleLinear, scaleSymlog } from 'd3';
	import { ramp_color } from '../../js/layers';
	import { AccessibilityIndexType, INDEX_UNIT } from '../../js/types';

	let {
		steps,
		type,
		threshold,
		label
	}: {
		/** The city's values in steps of 5% of residents, worst served first. */
		steps: number[];
		type: AccessibilityIndexType;
		threshold: number;
		/** What the chart shows, for a screen reader. */
		label: string;
	} = $props();

	const HEIGHT = 76;
	const TOP = 14;
	let width = $state(0);

	const x = $derived(
		scaleBand<number>().domain(range(steps.length)).range([0, width]).paddingInner(0.14)
	);
	// Area per person spans orders of magnitude, as on the map.
	const y = $derived(
		(type === AccessibilityIndexType.PER_PERSON ? scaleSymlog().constant(1) : scaleLinear())
			.domain([0, Math.max(max(steps) ?? 0, threshold * 1.3)])
			.range([HEIGHT - 1, TOP])
	);
	const color = $derived(ramp_color(steps, threshold, type));
</script>

<figure class="m-0 flex flex-col gap-1">
	<div bind:clientWidth={width}>
		<svg {width} height={HEIGHT} role="img" aria-label={label}>
			{#each steps as value, i (i)}
				<rect
					x={x(i)}
					width={x.bandwidth()}
					y={Math.min(y(value), HEIGHT - 2.5)}
					height={Math.max(1.5, y(0) - y(value))}
					rx="1"
					fill={color(value)}
				/>
			{/each}
			<line x1="0" x2={width} y1={y(threshold)} y2={y(threshold)} class="target" />
			<text x={width} y={y(threshold) - 4} text-anchor="end" class="target-label">
				target {threshold}
				{INDEX_UNIT[type]}
			</text>
		</svg>
	</div>
	<figcaption class="flex justify-between font-mono text-[10px] text-muted-foreground">
		<span>worst served</span><span>residents, 5% each</span><span>best</span>
	</figcaption>
</figure>

<style>
	.target {
		stroke: var(--foreground);
		stroke-dasharray: 3 3;
	}

	/* Haloed in the card's colour, so it stays legible where it crosses a bar. */
	.target-label {
		font:
			500 10px ui-monospace,
			'SF Mono',
			Menlo,
			monospace;
		fill: var(--foreground);
		stroke: var(--card);
		stroke-width: 3px;
		paint-order: stroke;
		stroke-linejoin: round;
	}
</style>
