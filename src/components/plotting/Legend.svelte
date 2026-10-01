<script lang="ts">
	/**
	 * The colour ramp under a choropleth: the same bounds, direction and scale the
	 * map draws with, and the target marked where the colour turns. Measure,
	 * Create and Draw share it. They each had a copy, and Create's sat under the
	 * map canvas, where it never showed.
	 */
	import { format, scaleDiverging } from 'd3';
	import { ACOLOR_GREEN, ACOLOR_MID, ACOLOR_RED } from '../../js/colors';
	import { is_clamped_high, robust_bounds } from '../../js/layers';
	import {
		AccessibilityIndexType,
		ClassificationScheme,
		INDEX_CLASSIFICATION,
		INDEX_UNIT
	} from '../../js/types';

	let {
		values,
		type,
		threshold
	}: {
		/** The cell values on the map. */
		values: number[];
		type: AccessibilityIndexType;
		threshold: number;
	} = $props();

	const STEPS = 40;
	const TICKS = 4;
	const M = { top: 4, right: 15, bottom: 18, left: 15 };
	const RAMP = 8;
	const GAP = 5;
	const axis = M.top + RAMP + GAP;

	let width = $state(0);
	const inner = $derived(Math.max(0, width - M.left - M.right));
	const log = $derived(INDEX_CLASSIFICATION[type] === ClassificationScheme.LOGARITHMIC);
	const scaled = (x: number) => (log ? (x === 0 ? 0 : Math.log(x)) : x);

	/*
		The SAME bounds the map's ramp uses: get_colormap_rule clamps outliers off,
		and a legend drawn from the raw min and max would disagree with the map.
	*/
	const bounds = $derived(robust_bounds(values, threshold));
	const lo = $derived(scaled(bounds.min));
	const hi = $derived(scaled(bounds.max));
	const target = $derived(scaled(threshold));
	const clamped = $derived(is_clamped_high(values, threshold));
	// A shorter walk is better, so distance runs green to red; the others red to green.
	const color = $derived(
		scaleDiverging<string>()
			.domain([lo, target, hi])
			.range(
				type === AccessibilityIndexType.MINIMUM_DISTANCE
					? [ACOLOR_GREEN, ACOLOR_MID, ACOLOR_RED]
					: [ACOLOR_RED, ACOLOR_MID, ACOLOR_GREEN]
			)
	);
	const at = (i: number, n: number) => lo + ((hi - lo) * i) / n;
	const label = (i: number) =>
		format('~s')(Math.round(log ? Math.exp(at(i, TICKS)) : at(i, TICKS))) +
		(i === TICKS && clamped ? '+' : '');
</script>

{#if values.length > 0 && Number.isFinite(threshold)}
	<div class="legend-container" bind:clientWidth={width}>
		<figure>
			<!--
				The caption names the target, so the white notch on the ramp has a
				meaning: without it ESA's 1.4%-wide below-target band read as "near
				zero" instead of "misses the target".
			-->
			<figcaption>
				{INDEX_CLASSIFICATION[type]} scale · {INDEX_UNIT[type]} · target {threshold}
			</figcaption>
			<svg {width} height={axis + M.bottom} aria-hidden="true">
				<!-- No stroke on the steps: a stroked ramp reads as class breaks the data does not have. -->
				{#each Array(STEPS) as _, i (i)}
					<rect
						x={M.left + (i * inner) / STEPS}
						y={M.top}
						width={inner / STEPS}
						height={RAMP}
						fill={color(at(i, STEPS))}
					/>
				{/each}

				<line x1={M.left} y1={axis} x2={M.left + inner} y2={axis} stroke="#aaa" />
				{#each Array(TICKS + 1) as _, i (i)}
					{@const x = M.left + (i * inner) / TICKS}
					<line x1={x} y1={axis - 2} x2={x} y2={axis + 2} stroke="#aaa" />
					<text {x} y={axis + 12} text-anchor={i === TICKS ? 'end' : 'middle'}>{label(i)}</text>
				{/each}

				{#if hi > lo && target >= lo && target <= hi}
					{@const mx = M.left + ((target - lo) / (hi - lo)) * inner}
					<line
						x1={mx}
						y1={M.top - 3}
						x2={mx}
						y2={M.top + RAMP + 3}
						stroke="#ffffff"
						stroke-width="1.5"
					/>
				{/if}
			</svg>
		</figure>
	</div>
{/if}

<style>
	/*
		Centred over the map by the box model. No padding here: the svg is sized
		from this element's width and carries its own 15px margins.
	*/
	.legend-container {
		position: absolute;
		left: 1rem;
		right: 1rem;
		/* Clear of the map attribution, which spans a half-width map. */
		bottom: 2.5rem;
		margin: 0 auto;
		max-width: 25rem;
		border-radius: 5px;
		background-color: rgba(10, 10, 10, 0.78);
		color: white;
	}

	figure {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		margin: 0;
		padding: 0.375rem 0 0.25rem;
	}

	figcaption {
		/* The svg's left margin, so caption and ramp share an edge. */
		padding-inline: 15px;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	text {
		font-size: 10px;
		fill: white;
	}
</style>
