<script lang="ts">
	import { scaleDiverging, scaleLinear } from 'd3-scale';
	import {
		current_accessibility_index,
		current_accessibility_index_data
	} from '../../stores/stores';

	import { max, min } from 'd3-array';
	import { onMount, onDestroy, afterUpdate } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import { AV_COLOR_GREEN, AV_COLOR_RED, AV_COLOR_WHITE, ToRGBA } from '../../js/colors';
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

					if (current && current.classification == ClassificationScheme.LOGARITHMIC) {
						minv = minv == 0 ? 0 : Math.log(minv);
						maxv = maxv == 0 ? 0 : Math.log(maxv);
						threshold = threshold == 0 ? 0 : Math.log(threshold);
					}

					colorScale = scaleDiverging().domain([minv, threshold, maxv]).range(get_color_range());
					xScale = scaler().domain([0, n_steps]).range([minv, maxv]);
					xTicksValueScale = scaler().domain([0, n_xticks]).range([minv, maxv]);

					loading = false;

					window.onresize = () => {
						offset = (containerWidth - width - 20) / 2;
					};
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
			return [ToRGBA(AV_COLOR_GREEN, 1.0), ToRGBA(AV_COLOR_WHITE, 1.0), ToRGBA(AV_COLOR_RED, 1.0)];
		else
			return [ToRGBA(AV_COLOR_RED, 1.0), ToRGBA(AV_COLOR_WHITE, 1.0), ToRGBA(AV_COLOR_GREEN, 1.0)];
	}

	let loading = false;
	let unsubscribe_accessibility_index: (() => void) | undefined;
	let minv: number;
	let maxv: number;
	let offset: number;

	let legend_node;

	export let metadata;
	export let containerWidth: number;

	let margins = {
		top: 25,
		right: 15,
		bottom: 20,
		left: 15
	};

	let ticks = {
		font: 10,
		margin: 5,
		height: 2,
		stroke: 1,
		color: '#AAA'
	};

	let legend = {
		height: 8,
		stroke: 'black',
		stroke_width: 1,
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

	$: if (metadata) current = metadata.getTarget($current_accessibility_index).index;
	$: if (metadata) threshold = metadata.getTarget($current_accessibility_index).threshold;

	$: n_steps = 40;
	$: n_xticks = 4;
	$: width = containerWidth < 500 ? containerWidth * 0.7 : containerWidth / 2;
	$: innerWidth = width - margins.left - margins.right;
	$: width_class = innerWidth / n_steps;
	$: offset = (containerWidth - width - 20) / 2;
</script>

{#if $current_accessibility_index_data && current && !loading}
	<div bind:this={legend_node} class="legend-container" style="position:absolute; left:{offset}px;">
		<figure>
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
							? format('.2s')(Math.round(Math.exp(xTicksValueScale(index))))
							: format('.2s')(Math.round(xTicksValueScale(index)))}
					</text>

					<line x1={xm} y1={y1m} x2={xm} y2={y2m} stroke="#AAA" stroke-width={ticks.stroke} />
				{/each}

				<text
					dominant-baseline="middle"
					alignment-baseline="middle"
					text-anchor="left"
					font-weight="normal"
					font-size={ticks.font}
					fill={legend.font_color}
					x={margins.left}
					y={margins.top - ticks.font}
				>
					classification: {current.classification} unit: {current.unit}
				</text>

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
		position: absolute;
		bottom: 1.5rem;
		background-color: rgba(10, 10, 10, 0.75);
		border-radius: 5px;
		color: white;
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
