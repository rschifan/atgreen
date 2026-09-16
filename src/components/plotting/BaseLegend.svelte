<script lang="ts">
	import { scaleDiverging, scaleLinear } from 'd3-scale';
	import { format, max, min } from 'd3';
	import { afterUpdate, onDestroy, onMount } from 'svelte';
	import { AV_COLOR_GREEN, AV_COLOR_MID, AV_COLOR_RED, ToRGBA } from '../../js/colors';
	import { AccessibilityIndexType, ClassificationScheme, UnitType } from '../../js/types';

	export let index_type: number;
	export let data: object;
	export let threshold: number;
	/*
		Measured, not passed. Callers used to compute this from a
		`<svelte:window bind:innerWidth>` breakpoint — `innerWidth > 500 ? 400 :
		innerWidth / 2` — which was only ever right for a full-width map and is
		meaningless inside a grid cell or a rail.
	*/
	let width = 0;

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
	let n_xticks = 4;
	let width_class: number;
	/*
		The log transform goes in a LOCAL, never back into `threshold`.

		`threshold` is bound out to Create's and Draw's `current_target`, so
		`threshold = Math.log(threshold)` here overwrote the user's target with its
		own logarithm on every afterUpdate: 9 -> 2.197 -> 0.787 -> -0.239 -> NaN,
		which is the "Target — NaN sq m" on the Create rail. The map ramp was
		corrupted the same way twice over, because get_colormap_rule() applies
		to_scale() to the threshold itself — it always wanted the raw value.
	*/
	let scaled_threshold: number;
	let minv: number;
	let maxv: number;

	let innerWidth: number;
	let colorScale;
	let xScale;
	let xTicksValueScale;
	let classification: string;
	let unit: string;

	$: innerWidth = width - margins.left - margins.right;
	$: width_class = innerWidth / n_steps;

	// A target of 0 is a real value and is falsy, so the legend never redrew for it.
	$: if (threshold !== undefined && threshold !== null) update();

	function update() {
		colorScale = scaleDiverging().domain([minv, scaled_threshold, maxv]).range(get_color_range());
	}

	afterUpdate(() => {
		if (index_type == AccessibilityIndexType.PER_PERSON)
			classification = ClassificationScheme.LOGARITHMIC;
		else classification = ClassificationScheme.LINEAR;

		switch (index_type) {
			case AccessibilityIndexType.MINIMUM_DISTANCE:
				unit = UnitType.MINUTES;
				break;
			case AccessibilityIndexType.EXPOSURE:
				unit = UnitType.HECTARS;
				break;
			case AccessibilityIndexType.PER_PERSON:
				unit = UnitType.SQUARE_METERS;
				break;
			default:
				unit = UnitType.MINUTES;
				break;
		}
		if (data && data.features.length > 0) {
			const accessibility_values: number[] = [...data.features.map((o: any) => o.properties.v)];

			minv = min(accessibility_values);
			maxv = max(accessibility_values);

			if (classification == ClassificationScheme.LOGARITHMIC) {
				minv = minv == 0 ? 0 : Math.log(minv);
				maxv = maxv == 0 ? 0 : Math.log(maxv);
				scaled_threshold = threshold == 0 ? 0 : Math.log(threshold);
			} else {
				scaled_threshold = threshold;
			}

			colorScale = scaleDiverging().domain([minv, scaled_threshold, maxv]).range(get_color_range());
			xScale = scaleLinear().domain([0, n_steps]).range([minv, maxv]);
			xTicksValueScale = scaleLinear().domain([0, n_xticks]).range([minv, maxv]);
		}
	});

	onDestroy(() => {});

	onMount(() => {});

	function get_color_range(): string[] {
		if (index_type == AccessibilityIndexType.MINIMUM_DISTANCE)
			return [ToRGBA(AV_COLOR_GREEN, 1.0), ToRGBA(AV_COLOR_MID, 1.0), ToRGBA(AV_COLOR_RED, 1.0)];
		else return [ToRGBA(AV_COLOR_RED, 1.0), ToRGBA(AV_COLOR_MID, 1.0), ToRGBA(AV_COLOR_GREEN, 1.0)];
	}
	let legend_node;
	let parent_node;
</script>

{#if data && data.features.length > 0 && minv >= 0 && maxv >= 0}
	<div bind:this={legend_node} bind:clientWidth={width} class="legend-container">
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
						{classification == ClassificationScheme.LOGARITHMIC
							? format('~s')(Math.round(Math.exp(xTicksValueScale(index))))
							: format('~s')(Math.round(xTicksValueScale(index)))}
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
					classification: {classification} unit: {unit}
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
	/*
		Centred by the box model, not by a JS `left` offset recomputed inside
		afterUpdate — which also assigned `window.onresize` on every render,
		clobbering any other handler on the page and never removing itself.
	*/
	div.legend-container {
		position: absolute;
		left: 1rem;
		right: 1rem;
		bottom: 1.5rem;
		margin: 0 auto;
		max-width: 25rem;
		background-color: rgba(10, 10, 10, 0.75);
		border-radius: 5px;
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
