<script lang="ts">
	import { ComboBox, ToastNotification } from 'carbon-components-svelte';
	import ToolPane from './ToolPane.svelte';
	import { format, geoMercator, geoPath, max, min, scaleThreshold, select, selectAll } from 'd3';
	import { ckmeans } from 'simple-statistics';
	import { afterUpdate, onDestroy, onMount } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import { get_city_accessibility_band } from '../js/api';
	import type { TargetStoreImpl } from '../js/types';
	import { current_city, loading } from '../stores/stores';
	import {
		count_transictions,
		get_buckets,
		get_frequencies,
		join_on_cell,
		sum_k
	} from '../js/stats';

	// This was a hardcoded list of seven that omitted BE1 entirely, so one of the
	// eight published indexes could not be compared at all. /rpc/getindexes returns
	// the real set; derive from it so adding an index server-side is enough.
	$: accessibility_indexes = (metadata?.indexes() ?? []).map((text: string, id: number) => ({
		id,
		text
	}));

	const props = {
		nbreaks: 4,
		margins: { left: 20, top: 10, bottom: 10 },
		stroke: { width: 2, color: 'black' },
		fill: { color: 'darkgrey' },
		lines: { stroke: 2, color: 'rgba(200,200,200,100)' },
		rectangles: { width: 10 },
		labels: { size: '0.7em', padding: 5, color: 'darkgrey' },
		map: { height: 400 }
	};

	let selectedIdA = 0;
	let selectedIdB = 1;
	let colors = ['#bae4b3', '#74c476', '#31a354', '#006d2c'];

	let bucketsA: number[], bucketsB: number[];
	let breaksA: number[], breaksB: number[];
	let valuesA: number[], valuesB: number[];
	let freqA: number[], freqB: number[];
	let flows: {};

	let indexA: string;
	let indexB: string;
	let dataA: [];
	let dataB: [];

	let u_left, u_right;
	let colorScaleA, colorScaleB, scaleA, scaleB;

	let maps_ids = ['#left g.map', '#right g.map'];
	let selected_cell_color = 'rgba(254, 95, 85, 0.5)';

	let height: number = props.map.height;
	let columnWidth: number;

	let unsubscribe_current_city_event: Unsubscriber;

	/*
		Measured from the stage, not the window. `innerWidth` was the width of the
		browser, which stopped being the width of this view the moment a 300px rail
		appeared beside it — and it also meant every resize event invalidated the
		component, which re-ran `draw_maps` and rebuilt all 26,440 SVG paths.
	*/
	let stageWidth = 0;

	$: {
		// Clamp at zero. On the first render the stage has not been measured yet, so
		// `stageWidth` is 0 and the narrow branch made `columnWidth` negative — which
		// d3's projection turns into `M NaN,NaN` for every path in both maps. That
		// flooded the console with thousands of SVG errors before the real width
		// arrived and quietly redrew over them.
		columnWidth = Math.max(
			0,
			stageWidth < 500 ? stageWidth - 2 * props.margins.left : stageWidth / 2
		);
		height = columnWidth > 0 && columnWidth < height ? columnWidth : props.map.height;
	}
	export let metadata: TargetStoreImpl;

	function subscribe_current_city_event() {
		unsubscribe_current_city_event = current_city.subscribe((value) => {
			if (value) update();
		});
	}

	function select_flow(from: number, to: number) {
		let lines = selectAll('line');
		let from_rects = selectAll('#from_buckets > rect');
		let to_rects = selectAll('#to_buckets > rect');
		lines.classed('low-opacity', true);
		from_rects.classed('low-opacity', true);
		to_rects.classed('low-opacity', true);

		from_rects
			?.filter(function () {
				return this.getAttribute('q') == from;
			})
			.classed('selected', true)
			.classed('low-opacity', false);

		to_rects
			?.filter(function () {
				return this.getAttribute('q') == to;
			})
			.classed('selected', true)
			.classed('low-opacity', false);
		// lines
		// 	.filter(function () {
		// 		return this.getAttribute('from') == from && this.getAttribute('to') == to;
		// 	})
		// 	.classed('selected', true)
		// 	.classed('low-opacity', false);
	}

	function select_cell(x: number, y: number): boolean {
		let flow = [];

		maps_ids.forEach((current, i) => {
			let cell = select(current)
				.selectAll('path')
				.filter(function (d) {
					if (!d) return false;
					return d.properties.x == x && d.properties.y == y;
				});

			if (cell.empty()) return false;

			cell.attr('fill', selected_cell_color);
			flow[i] = cell.attr('q');
		});

		select_flow(flow[0], flow[1]);

		return true;
	}

	function unselect_cell(x: number, y: number) {
		maps_ids.forEach((current, i) => {
			select(current)
				.selectAll('path')
				.filter(function (d) {
					return d.properties.x == x && d.properties.y == y;
				})
				.attr('fill', (d) => {
					return i == 0 ? colorScaleA(d.properties.v) : colorScaleB(d.properties.v);
				});
		});
		unselect_bucket();
	}

	function draw_maps(dataA, dataB) {
		select('#left g.map').selectChildren().remove();
		select('#right g.map').selectChildren().remove();

		let projectionA = geoMercator();
		let projectionB = geoMercator();

		projectionA.fitExtent(
			[
				[0, 0],
				[columnWidth, height]
			],
			dataA
		);
		projectionB.fitExtent(
			[
				[0, 0],
				[columnWidth, height]
			],
			dataB
		);

		u_left = select('#left g.map').selectAll('path').data(dataA.features);
		u_left
			.enter()
			.append('path')
			.attr('d', geoPath().projection(projectionA))
			.attr('fill', (d) => {
				return colorScaleA(d.properties.v);
			})
			.attr('stroke-width', 0)
			.attr('q', (d) => {
				return scaleA(d.properties.v);
			})
			.on('mouseover', (e, datum) => {
				select_cell(datum.properties.x, datum.properties.y);
			})
			.on('mouseout', (e, datum) => {
				unselect_cell(datum.properties.x, datum.properties.y);
			});

		u_right = select('#right g.map').selectAll('path').data(dataB.features);

		u_right
			.enter()
			.append('path')
			.attr('d', geoPath().projection(projectionB))
			.attr('fill', (d) => {
				return colorScaleB(d.properties.v);
			})
			// .attr('stroke', '#000')
			.attr('stroke-width', 0)
			.attr('q', (d) => {
				return scaleB(d.properties.v);
			})
			.on('mouseover', (e, datum) => {
				select_cell(datum.properties.x, datum.properties.y);
			})
			.on('mouseout', (e, datum) => {
				unselect_cell(datum.properties.x, datum.properties.y);
			});
	}

	function get_x(i: number, index: number, innerWidth: number): number {
		const rate: number =
			index == 0 ? sum_k(freqA, i) / valuesA.length : sum_k(freqB, i) / valuesB.length;

		return innerWidth * rate;
	}

	function get_width(i: number, index: number, innerWidth: number): number {
		const rate: number = index == 0 ? freqA[i] / valuesA.length : freqB[i] / valuesB.length;
		return innerWidth * rate;
	}

	let same_index = false;
	async function update() {
		if (selectedIdA >= 0 && selectedIdB >= 0) {
			if (selectedIdA == selectedIdB) {
				same_index = true;
			} else {
				same_index = false;
				indexA = accessibility_indexes?.filter((obj) => {
					return obj.id == selectedIdA;
				})[0]?.text;
				indexB = accessibility_indexes?.filter((obj) => {
					return obj.id == selectedIdB;
				})[0]?.text;

				if ($current_city && indexA && indexB && indexA != indexB) {
					dataA = undefined;
					dataB = undefined;

					select('#left g.map').selectChildren().remove();
					select('#right g.map').selectChildren().remove();

					let bandA: number, bandB: number;

					// `metadata?.getTarget(x)` guards metadata but not the lookup: getTarget
					// returns undefined for an unknown index, and `.index` on that throws.
					const _indexA = metadata?.getTarget(indexA)?.index?.band;
					const _indexB = metadata?.getTarget(indexB)?.index?.band;

					if (_indexA !== undefined && _indexB !== undefined && _indexA >= 0 && _indexB >= 0) {
						loading.set(true);
						bandA = _indexA;
						bandB = _indexB;

						// The inner Promise.all was not returned, so .finally cleared the
						// overlay before either body had been parsed, and a JSON failure
						// escaped .catch as an unhandled rejection.
						(async () => {
							try {
								const [dA, dB] = await Promise.all([
									get_city_accessibility_band($current_city.text, bandA),
									get_city_accessibility_band($current_city.text, bandB)
								]);
								if (!dA.ok || !dB.ok)
									throw new Error(`compare request failed: HTTP ${dA.status}/${dB.status}`);
								const [d_jsonA, d_jsonB] = await Promise.all([dA.json(), dB.json()]);
								dataA = d_jsonA;
								dataB = d_jsonB;
								if (dataA?.features?.length > 0 && dataB?.features?.length > 0) {
									draw(dataA, dataB);
								}
							} catch (error) {
								console.error('Compare: could not load the two indexes', error);
							} finally {
								loading.set(false);
							}
						})();
					}
				}
			}
		} else
			console.log(
				'Make sure to have selected a city and the two indexes!',
				$current_city,
				indexA,
				indexB
			);
	}

	function draw(dataA, dataB) {
		// The two value arrays used to be filtered independently and then zipped by
		// position. Different indexes cover different numbers of cells (Turin: 3,755
		// for WHO against 3,867 for BE3), so past the first divergence every pair
		// compared two different places and the surplus was silently dropped. Join on
		// the grid coordinates instead — features carry no stable id, only x/y/v.
		const joined = join_on_cell(dataA?.features, dataB?.features);
		valuesA = joined.map((d) => d.a);
		valuesB = joined.map((d) => d.b);

		if (valuesA.length === 0) {
			flows = undefined;
			return;
		}

		breaksA = ckmeans(valuesA, props.nbreaks).map((v) => {
			return min(v);
		});
		breaksA.push(max(valuesA));

		breaksB = ckmeans(valuesB, props.nbreaks).map((v) => {
			return min(v);
		});
		breaksB.push(max(valuesB));

		colorScaleA = scaleThreshold().domain(breaksA.slice(1)).range(colors);
		colorScaleB = scaleThreshold().domain(breaksB.slice(1)).range(colors);

		scaleA = scaleThreshold()
			.domain(breaksA.slice(1))
			.range(Array.from({ length: props.nbreaks }, (_, index) => index));
		scaleB = scaleThreshold()
			.domain(breaksB.slice(1))
			.range(Array.from({ length: props.nbreaks }, (_, index) => index));

		bucketsA = get_buckets(valuesA, breaksA);
		bucketsB = get_buckets(valuesB, breaksB);

		freqA = get_frequencies(bucketsA, props.nbreaks);
		freqB = get_frequencies(bucketsB, props.nbreaks);
		flows = count_transictions(bucketsA, bucketsB);
	}

	function unselect_bucket() {
		selectAll('line').classed('selected', false).classed('low-opacity', false);
		selectAll('rect').classed('selected', false).classed('low-opacity', false);
		selectAll('path').classed('selected', false).classed('low-opacity', false);
	}

	function select_bucket(q: number, from: boolean) {
		const attr: string = from ? 'from' : 'to';

		let lines = selectAll('line');
		let from_rects = selectAll('#from_buckets > rect');
		let to_rects = selectAll('#to_buckets > rect');
		let to_clause = from ? to_rects : from_rects;
		let from_clause = from ? from_rects : to_rects;

		lines.classed('low-opacity', true);
		from_rects.classed('low-opacity', true);
		to_rects.classed('low-opacity', true);

		// if (from)
		// 	targets = new Set(
		// 		Object.entries(flows[q]).map((obj) => {
		// 			return obj[0];
		// 		})
		// 	);
		// else {
		// 	Object.entries(flows).forEach((current) => {
		// 		if (q in current[1]) targets.add(current[0]);
		// 	});
		// }

		from_clause
			?.filter(function () {
				return this.getAttribute('q') == q;
			})
			.classed('selected', true)
			.classed('low-opacity', false);

		to_clause
			?.filter(function () {
				// return targets.has(this.getAttribute('q'));
				return this.getAttribute('q') == q;
			})
			.classed('selected', true)
			.classed('low-opacity', false);

		// Select flows
		lines
			?.filter(function () {
				return this.getAttribute(attr) == q;
			})
			.classed('selected', true)
			.classed('low-opacity', false);

		selectAll('path')
			.filter(function () {
				return this.getAttribute('q') == q;
			})
			.classed('selected', true);
	}

	afterUpdate(() => {
		// `columnWidth > 0` is the same guard as above, at the other end: drawing
		// into an unmeasured stage produces NaN geometry.
		if (dataA && dataB && columnWidth > 0) draw_maps(dataA, dataB);
	});

	onMount(() => {
		subscribe_current_city_event();
	});

	onDestroy(() => {
		if (unsubscribe_current_city_event) unsubscribe_current_city_event();
	});

	// let options = {
	// 	toolbar: { enabled: false },
	// 	getStrokeColor: (group) => {
	// 		return 'white';
	// 	},
	// 	getFillColor: (group) => {
	// 		return colors[group.substring(1)[0]];
	// 	},
	// 	title: '',
	// 	alluvial: { nodePadding: 0, nodeAlignment: 'center' },
	// 	height: '400px'
	// };

	function get_node_label(i: number, index: string) {
		if (index) return `G${i} - ${index}`;
		return `G${i}`;
	}
</script>

<!-- <div>
	<ExpandableTile tileExpandedLabel="less" tileCollapsedLabel="more">
		<div slot="above">
			<h3><h3>Compare</h3></h3>
			<p>Compare the spatial configuration of two accessibility indexes.</p>
		</div>
		<div slot="below">
			<p>
				Select two indexes and compare the performance of the various areas of your city to
				investigate if all the green accessibility indexes tell the same story.
			</p>
			<p>Hover on a cell or a group to explore how it changes in the overall ranking.</p>
		</div>
	</ExpandableTile>
</div> -->

<ToolPane scroll>
	<svelte:fragment slot="rail">
		<ComboBox
			titleText="Index A"
			placeholder="Select an accessibility index"
			bind:selectedId={selectedIdA}
			items={accessibility_indexes}
			on:select={update}
		/>

		<ComboBox
			titleText="Index B"
			placeholder="Select an accessibility index"
			bind:selectedId={selectedIdB}
			items={accessibility_indexes}
			shouldFilterItem={(item) => item.id != selectedIdA}
			on:select={update}
		/>

		{#if same_index}
			<ToastNotification
				lowContrast
				kind="error"
				title="Pick two different indexes"
				subtitle="Comparing an index with itself has nothing to show."
			/>
		{/if}
	</svelte:fragment>

	<div bind:clientWidth={stageWidth} class="columns">
		{#if flows && !same_index}
			<div class="block" style="float: left;width:{stageWidth < 500 ? '100%' : '50%'}">
				<div style="text-align: center;">
					{indexA}
				</div>

				<div
					id="left"
					style="
				display: inline-block; 
				position: relative; 
				width: 100%;
				vertical-align: top;
				overflow: hidden;
			"
				>
					<svg preserveAspectRatio="xMidYMid meet" viewBox="0 0 {columnWidth} {height}">
						<g class="map" /></svg
					>
				</div>

				<div
					style="
				display: inline-block; 
				position: relative; 
				width: 100%;
				vertical-align: top;
				overflow: hidden;
			"
				>
					<svg
						preserveAspectRatio="xMidYMid meet"
						viewBox="0 0 {columnWidth} {props.rectangles.width + props.margins.top + 20}"
					>
						<g transform="translate({props.margins.left} {props.margins.top})" id="from_buckets">
							{#each Array(props.nbreaks) as _, q (q)}
								{@const innerWidth = columnWidth - 2 * props.margins.left}
								<rect
									{q}
									x={get_x(q, 0, innerWidth)}
									y={5}
									width={get_width(q, 0, innerWidth)}
									height={props.rectangles.width}
									fill={colors[q]}
									stroke-width={props.stroke.width}
									stroke={props.stroke.color}
									role="button"
									tabindex="0"
									aria-label="Highlight group {q}"
									on:mouseover={() => select_bucket(q, true)}
									on:focus={() => select_bucket(q, true)}
									on:mouseleave={() => unselect_bucket()}
									on:blur={() => unselect_bucket()}
								/>
							{/each}
							<g>
								{#each Array(props.nbreaks + 1) as _, q (q)}
									{@const innerWidth = columnWidth - 2 * props.margins.left}
									<text
										font-size={props.labels.size}
										dx={0}
										dominant-baseline="auto"
										text-anchor={q == 0 ? 'start ' : q == props.nbreaks ? 'start' : 'end'}
										class="small"
										fill="white"
										x={get_x(q, 0, innerWidth)}
										y={props.rectangles.width + props.margins.top + 5}
										>{format('.0s')(breaksA[q])}
									</text>
								{/each}
							</g>
							<g>
								{#each Array(props.nbreaks) as _, q (q)}
									{@const innerWidth = columnWidth - 2 * props.margins.left}
									<text
										font-size={props.labels.size}
										dx={0}
										dominant-baseline="auto"
										text-anchor={q == 0 ? 'middle ' : q == props.nbreaks ? 'middle' : 'middle'}
										class="small"
										fill="white"
										x={get_x(q, 0, innerWidth) + get_width(q, 0, innerWidth) / 2}
										y={0}
										>{get_node_label(q, '')}
									</text>
								{/each}
							</g>
						</g>
					</svg>
				</div>
			</div>

			<div class="block" style="float: right;width:{stageWidth < 500 ? '100%' : '50%'}">
				<div style="text-align: center;">
					{indexB}
				</div>

				<div
					style="
				display: inline-block; 
				position: relative; 
				width: 100%;
				vertical-align: top;
				overflow: hidden;
			"
					id="right"
				>
					<svg preserveAspectRatio="xMidYMid meet" viewBox="0 0 {columnWidth} {height}"
						><g class="map" /></svg
					>
				</div>

				<div
					style="
				display: inline-block; 
				position: relative; 
				width: 100%;
				vertical-align: top;
				overflow: hidden;				
			"
				>
					<svg
						preserveAspectRatio="xMidYMid meet"
						viewBox="0 0 {columnWidth} {props.rectangles.width + props.margins.top + 20}"
					>
						<g transform="translate({props.margins.left} {props.margins.top})" id="to_buckets">
							{#each Array(props.nbreaks) as _, q (q)}
								{@const innerWidth = columnWidth - 2 * props.margins.left}
								<rect
									{q}
									x={get_x(q, 1, innerWidth)}
									y={5}
									width={get_width(q, 1, innerWidth)}
									height={props.rectangles.width}
									fill={colors[q]}
									stroke-width={props.stroke.width}
									stroke={props.stroke.color}
									role="button"
									tabindex="0"
									aria-label="Highlight group {q}"
									on:mouseover={() => select_bucket(q, false)}
									on:focus={() => select_bucket(q, false)}
									on:mouseleave={() => unselect_bucket()}
									on:blur={() => unselect_bucket()}
									on:focus={(d) => {}}
								/>
							{/each}
						</g>
						<g
							transform="translate({props.margins.left} {props.margins.top})"
							id="to_bucket_labels"
						>
							{#each Array(props.nbreaks + 1) as _, q (q)}
								{@const innerWidth = columnWidth - 2 * props.margins.left}
								<text
									font-size={props.labels.size}
									dx={0}
									dominant-baseline="auto"
									text-anchor={q == 0 ? 'start ' : q == props.nbreaks ? 'start' : 'end'}
									class="small"
									fill="white"
									x={get_x(q, 1, innerWidth)}
									y={props.rectangles.width + props.margins.top + 5}
									>{format('.0s')(breaksB[q])}
								</text>
							{/each}
						</g>
						<g transform="translate({props.margins.left} {props.margins.top})" id="to_bucket_names">
							{#each Array(props.nbreaks) as _, q (q)}
								{@const innerWidth = columnWidth - 2 * props.margins.left}
								<text
									font-size={props.labels.size}
									dx={0}
									dominant-baseline="auto"
									text-anchor={q == 0 ? 'middle ' : q == props.nbreaks ? 'middle' : 'middle'}
									class="small"
									fill="white"
									x={get_x(q, 1, innerWidth) + get_width(q, 1, innerWidth) / 2}
									y={0}
									>{get_node_label(q, '')}
								</text>
							{/each}
						</g>
					</svg>
				</div>
			</div>
		{/if}
	</div>
</ToolPane>

<style>
	.columns {
		width: 100%;
	}

	div.block-half {
		display: inline-block;
	}

	div.block {
		display: inline-block;
		width: 50%;
	}

	p {
		margin-top: 10px;
	}

	div {
		padding: 10px 0px;
	}

	* :global(.low-opacity) {
		opacity: 0.2;
	}
	* :global(rect.selected),
	* :global(path.selected) {
		fill: rgba(254, 95, 85, 0.5);
		opacity: 1;
	}
	* :global(line.selected) {
		stroke-width: 3;
		opacity: 1;
	}

	* :global(rect.node-text-bg) {
		fill: red;
		color: red;
		background-color: brown;
	}

	:global(text#chart--alluvial-category-1) {
		visibility: hidden;
	}
	:global(text#chart--alluvial-category-0) {
		visibility: hidden;
	}
	:global(.cds--cc--alluvial rect.node) {
		fill: gray;
	}
</style>
