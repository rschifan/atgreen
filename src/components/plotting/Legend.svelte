<script lang="ts">
	import { scaleDiverging, scaleLinear } from 'd3-scale';
	import {
		current_accessibility_index,
		current_accessibility_index_data
	} from '../../stores/stores';

	import { max, min } from 'd3-array';
	import { onMount, onDestroy, afterUpdate } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import { AV_COLOR_GREEN, AV_COLOR_MID, AV_COLOR_RED, ToRGBA } from '../../js/colors';
	import { AccessibilityIndexImpl, ClassificationScheme } from '../../js/types';
	import { format } from 'd3';

	afterUpdate(() => {});

	onDestroy(() => {
		if (unsubscribe_accessibility_index) unsubscribe_accessibility_index();
		if (unsubscibe_accessibility_data_layer_event) unsubscibe_accessibility_data_layer_event();
	});

	onMount(() => {
		unsubscibe_accessibility_data_layer_event = current_accessibility_index_data.subscribe(
			(value) => {
				if (value) {
					let data = $current_accessibility_index_data.features.map((el) => {
						return el.properties.v;
					});

					minv = min(data);
					maxv = max(data);

					// if (metadata) current = metadata.getTarget($current_accessibility_index).index;
					// if (metadata) threshold = metadata.getTarget($current_accessibility_index).threshold;

					// The log transform goes in a local. `threshold` is re-derived from
					// `metadata` by a reactive statement, so logging it in place raced that
					// statement and could log an already-logged value — the same
					// corruption that reaches Create's rail as "Target — NaN sq m".
					let scaled_threshold = threshold;

					if (current && current.classification == ClassificationScheme.LOGARITHMIC) {
						minv = minv == 0 ? 0 : Math.log(minv);
						maxv = maxv == 0 ? 0 : Math.log(maxv);
						scaled_threshold = threshold == 0 ? 0 : Math.log(threshold);
					}

					colorScale = scaleDiverging()
						.domain([minv, scaled_threshold, maxv])
						.range(get_color_range());
					xScale = scaler().domain([0, n_steps]).range([minv, maxv]);
					xTicksValueScale = scaler().domain([0, n_xticks]).range([minv, maxv]);

					loading = false;

					// `window.onresize = ...` used to be here: it clobbered any other
					// handler on the page, was never removed, and sat inside a data
					// subscriber so it was reassigned on every payload. It was also
					// redundant — `$: offset = ...` below already recomputes from
					// containerWidth, which the parent binds with <svelte:window>.
				}
			}
		);

		unsubscribe_accessibility_index = current_accessibility_index.subscribe((value) => {
			if (value) {
				loading = true;
			}
		});
	});

	function get_color_range(): string[] {
		if (current && current.ascending)
			return [ToRGBA(AV_COLOR_GREEN, 1.0), ToRGBA(AV_COLOR_MID, 1.0), ToRGBA(AV_COLOR_RED, 1.0)];
		else return [ToRGBA(AV_COLOR_RED, 1.0), ToRGBA(AV_COLOR_MID, 1.0), ToRGBA(AV_COLOR_GREEN, 1.0)];
	}

	let loading = false;
	let unsubscribe_accessibility_index: (() => void) | undefined;
	let minv: number;
	let maxv: number;

	let legend_node;

	export let metadata;
	/*
		The legend lives in the rail now, not floating over the map, so it sizes
		itself from its own container instead of the window. It used to take
		`containerWidth` from a `<svelte:window bind:innerWidth>` in the parent and
		compute a left offset to fake centring — which was already only correct
		when the map happened to be full-width, and is simply wrong beside a rail.
	*/
	let containerWidth: number = 0;

	/*
		`top` used to be 25 to reserve room for a caption drawn *inside* the svg as
		<text>. The caption is now a real <figcaption>, so the svg only has to hold
		the ramp and its ticks.
	*/
	let margins = {
		top: 4,
		right: 15,
		bottom: 18,
		left: 15
	};

	let ticks = {
		font: 10,
		margin: 5,
		height: 2,
		stroke: 1,
		color: '#AAA'
	};

	/*
		The ramp is drawn as 40 discrete rects. Stroking each one in black turned a
		continuous scale into a barcode — the gaps read as class breaks that the
		data does not have. No stroke, so the 40 steps render as the gradient they
		are meant to be.
	*/
	let legend = {
		height: 8,
		stroke: 'none',
		stroke_width: 0,
		font_color: 'white'
	};

	let n_steps = 40;
	let n_xticks: number;
	let width_class: number;

	let innerWidth: number;
	let unsubscibe_accessibility_data_layer_event: Unsubscriber;

	let current: AccessibilityIndexImpl;

	let scaler = scaleLinear;
	let colorScale;
	let xScale;
	let xTicksValueScale;
	let threshold: number;

	// `metadata.getTarget(x)` returns undefined for an index that is not loaded yet,
	// and these ran before $current_accessibility_index was set. Svelte 4 happened to
	// evaluate them late enough to hide it; Svelte 5 does not, which is a scheduling
	// difference exposing a missing guard rather than a new bug.
	$: current = metadata?.getTarget($current_accessibility_index)?.index;
	$: threshold = metadata?.getTarget($current_accessibility_index)?.threshold;

	$: n_steps = 40;
	$: n_xticks = 4;
	// Fill the rail. The container stretches to the rail's width regardless of
	// what the svg inside it measures, so this cannot feed back on itself.
	$: width = Math.max(containerWidth, 0);
	$: innerWidth = width - margins.left - margins.right;
	$: width_class = innerWidth / n_steps;
</script>

{#if $current_accessibility_index_data && current && !loading}
	<div bind:this={legend_node} bind:clientWidth={containerWidth} class="legend-container">
		<figure>
			<figcaption class="eyebrow">
				{current.classification} scale &middot; {current.unit}
			</figcaption>
			<svg height={margins.top + margins.bottom + legend.height + ticks.margin} {width}>
				{#each Array(n_steps) as _, index (index)}
					<rect
						x={margins.left + index * width_class}
						y={margins.top}
						width={width_class}
						height={legend.height}
						stroke-width={legend.stroke_width}
						stroke={legend.stroke}
						fill={colorScale(xScale(index))}
					/>
				{/each}

				{#each Array(n_xticks + 1) as _, index (index)}
					{@const xm = margins.left + (index * innerWidth) / n_xticks}
					{@const y1m = margins.top + legend.height + ticks.margin - ticks.height}
					{@const y2m = y1m + 2 * ticks.height}

					<text
						dominant-baseline="middle"
						alignment-baseline="middle"
						text-anchor={index == 0 ? 'middle' : index == n_xticks ? 'end' : 'middle'}
						font-weight="normal"
						font-size={ticks.font}
						fill={legend.font_color}
						x={margins.left + (index * innerWidth) / n_xticks}
						y={margins.top + legend.height + ticks.margin + ticks.font}
					>
						{current.classification == ClassificationScheme.LOGARITHMIC
							? format('~s')(Math.round(Math.exp(xTicksValueScale(index))))
							: format('~s')(Math.round(xTicksValueScale(index)))}
					</text>

					<line x1={xm} y1={y1m} x2={xm} y2={y2m} stroke="#AAA" stroke-width={ticks.stroke} />
				{/each}

				<line
					x1={margins.left}
					y1={margins.top + legend.height + ticks.margin}
					x2={margins.left + innerWidth}
					y2={margins.top + legend.height + ticks.margin}
					stroke={ticks.color}
					stroke-width={ticks.stroke}
				/>
			</svg>
		</figure>
	</div>
{/if}

<style>
	div.legend-container {
		color: white;
	}

	figure {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 0;
	}

	.eyebrow {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--cds-text-05, #8d8d8d);
	}

	line:hover,
	text:hover,
	rect:hover {
		outline: none;
	}

	line:focus,
	text:focus,
	rect:focus {
		outline: none;
	}

	svg text {
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		user-select: none;
	}
	svg text::selection {
		background: none;
	}
</style>
