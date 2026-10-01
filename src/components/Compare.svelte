<script lang="ts">
	/**
	 * Two indexes side by side, each as a map of natural-break groups with a bar of
	 * how many cells fall in each. Hovering a cell finds it in both maps; hovering a
	 * group lights that group up in both.
	 */
	import type * as GeoJSON from 'geojson';
	import { format, geoMercator, geoPath, select } from 'd3';
	import { tick } from 'svelte';
	import { get_accessibility_layer } from '../js/api';
	import { classify, join_on_cell } from '../js/stats';
	import type { TargetStoreImpl } from '../js/types';
	import { current_city } from '../stores/stores';
	import SelectField from './fields/SelectField.svelte';
	import ToolPane from './ToolPane.svelte';

	export let metadata: TargetStoreImpl;

	const GROUPS = 4;
	const COLORS = ['#bae4b3', '#74c476', '#31a354', '#006d2c'];
	const MARGIN = 20;
	const BAR = 10;
	const MAP_HEIGHT = 400;

	type Side = {
		name: string;
		data: GeoJSON.FeatureCollection;
	} & ReturnType<typeof classify>;

	let selectedIdA = 0;
	let selectedIdB = 1;
	let sides: Side[] | undefined;
	let root: HTMLElement;
	let stageWidth = 0;
	let loads = 0;

	// Derived from /rpc/getindexes, so adding an index server-side is enough.
	$: indexes = metadata?.indexes() ?? [];
	$: items_a = indexes.map((label, id) => ({ value: String(id), label }));
	// Index B cannot be the index already chosen as A.
	$: items_b = items_a.map((i) => ({ ...i, disabled: Number(i.value) === selectedIdA }));
	$: same_index = selectedIdA === selectedIdB;

	// Clamped at zero: before the stage is measured, a negative width gives d3
	// `M NaN,NaN` for every path.
	$: columnWidth = Math.max(0, stageWidth < 500 ? stageWidth - 2 * MARGIN : stageWidth / 2);
	$: height = columnWidth > 0 && columnWidth < MAP_HEIGHT ? columnWidth : MAP_HEIGHT;
	$: inner = columnWidth - 2 * MARGIN;

	$: load($current_city?.text, indexes[selectedIdA], indexes[selectedIdB]);
	$: if (sides && columnWidth > 0) draw_maps(sides, columnWidth, height);

	async function load(city: string | undefined, a: string | undefined, b: string | undefined) {
		const load_id = ++loads;
		sides = undefined;
		const bandA = a ? metadata?.getBand(a) : undefined;
		const bandB = b ? metadata?.getBand(b) : undefined;
		if (!city || !a || !b || a === b || bandA === undefined || bandB === undefined) return;
		try {
			// The same requests Measure makes, so a band it has drawn comes from the cache.
			const [dataA, dataB] = await Promise.all([
				get_accessibility_layer(city, bandA).send(),
				get_accessibility_layer(city, bandB).send()
			]);
			if (load_id !== loads) return; // a newer choice is already on its way
			// Joined on the grid: two indexes cover different cells (Turin: 3,755 for
			// WHO, 3,867 for BE3), so zipping their values by position mispaired them.
			const joined = join_on_cell(dataA?.features, dataB?.features);
			if (joined.length === 0) return;
			sides = [
				{
					name: a,
					data: dataA,
					...classify(
						joined.map((d) => d.a),
						GROUPS
					)
				},
				{
					name: b,
					data: dataB,
					...classify(
						joined.map((d) => d.b),
						GROUPS
					)
				}
			];
		} catch (error) {
			console.error('Compare: could not load the two indexes', error);
		}
	}

	async function draw_maps(sides: Side[], width: number, height: number) {
		await tick();
		select(root)
			.selectAll<SVGSVGElement, unknown>('svg.map')
			.each(function (_, i) {
				const side = sides[i];
				const projection = geoMercator().fitExtent(
					[
						[0, 0],
						[width, height]
					],
					side.data
				);
				select(this)
					.selectAll('path')
					.data(side.data.features)
					.join('path')
					.attr('d', geoPath(projection))
					.attr('fill', (d) => COLORS[side.group(d.properties?.v)])
					.attr('data-q', (d) => side.group(d.properties?.v))
					.on('mouseover', (_, d) => highlight_cell(d.properties?.x, d.properties?.y))
					.on('mouseout', clear);
			});
	}

	/** One place, in both maps, and the group it falls in on each side. */
	function highlight_cell(x: number, y: number) {
		const groups: (string | null)[] = [];
		select(root)
			.selectAll('svg.map')
			.each(function (_, i) {
				const cell = select(this)
					.selectAll<SVGPathElement, GeoJSON.Feature>('path')
					.filter((d) => d.properties?.x === x && d.properties?.y === y)
					.classed('hit', true);
				groups[i] = cell.empty() ? null : cell.attr('data-q');
			});
		select(root)
			.selectAll('svg.groups')
			.each(function (_, i) {
				select(this)
					.selectAll<SVGRectElement, unknown>('rect')
					.classed('dim', function () {
						return this.dataset.q !== groups[i];
					});
			});
	}

	/** One group, in both maps and both bars. */
	function highlight_group(q: number) {
		select(root).selectAll(`path[data-q="${q}"]`).classed('hit', true);
		select(root)
			.selectAll<SVGRectElement, unknown>('svg.groups rect')
			.classed('dim', function () {
				return this.dataset.q !== String(q);
			});
	}

	function clear() {
		select(root).selectAll('.hit').classed('hit', false);
		select(root).selectAll('.dim').classed('dim', false);
	}

	// SI prefixes only for the large: `format('s')` writes 0.5 ha as "500m".
	const bound_label = (v: number) =>
		v >= 1000 ? format('.2~s')(v) : String(Math.round(v * 10) / 10);
	const offset = (freq: number[], q: number) => freq.slice(0, q).reduce((a, b) => a + b, 0);
	const total = (freq: number[]) => offset(freq, freq.length) || 1;
</script>

<ToolPane scroll>
	<svelte:fragment slot="rail">
		<SelectField
			title="Index A"
			placeholder="Select an accessibility index"
			items={items_a}
			value={String(selectedIdA)}
			onchange={(v) => (selectedIdA = Number(v))}
		/>
		<SelectField
			title="Index B"
			placeholder="Select an accessibility index"
			items={items_b}
			value={String(selectedIdB)}
			error={same_index
				? 'Pick an index other than A: an index compared with itself has nothing to show.'
				: undefined}
			onchange={(v) => (selectedIdB = Number(v))}
		/>
	</svelte:fragment>

	<div bind:clientWidth={stageWidth} bind:this={root} class="columns">
		{#if sides && !same_index}
			{#each sides as side (side.name)}
				<section class="column" style:width={stageWidth < 500 ? '100%' : '50%'}>
					<h2 class="title">{side.name}</h2>
					<svg
						class="map"
						preserveAspectRatio="xMidYMid meet"
						viewBox="0 0 {columnWidth} {height}"
						role="img"
						aria-label="{side.name} across the city, in {GROUPS} groups"
					></svg>
					<svg class="groups" viewBox="0 0 {columnWidth} {BAR + 40}">
						<g transform="translate({MARGIN} 12)">
							{#each side.freq as count, q (q)}
								{@const x = (inner * offset(side.freq, q)) / total(side.freq)}
								{@const w = (inner * count) / total(side.freq)}
								<rect
									data-q={q}
									{x}
									y="5"
									width={w}
									height={BAR}
									fill={COLORS[q]}
									role="button"
									tabindex="0"
									aria-label="Highlight group {q}"
									on:mouseover={() => highlight_group(q)}
									on:focus={() => highlight_group(q)}
									on:mouseleave={clear}
									on:blur={clear}
								/>
								<text x={x + w / 2} y="0" text-anchor="middle">G{q}</text>
							{/each}
							{#each side.breaks as bound, q (q)}
								<text
									x={(inner * offset(side.freq, q)) / total(side.freq)}
									y={BAR + 20}
									text-anchor={q === 0 ? 'start' : q === side.breaks.length - 1 ? 'end' : 'middle'}
									>{bound_label(bound)}</text
								>
							{/each}
						</g>
					</svg>
				</section>
			{/each}
		{/if}
	</div>
</ToolPane>

<style>
	.columns {
		display: flex;
		flex-wrap: wrap;
		width: 100%;
	}

	.column {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem 0;
	}

	.title {
		margin: 0;
		text-align: center;
		font-size: 1rem;
		font-weight: 500;
	}

	text {
		font-size: 0.7em;
		fill: var(--muted-foreground);
	}

	rect {
		stroke: var(--background);
		stroke-width: 2;
		cursor: pointer;
	}

	/* Toggled by d3, so outside Svelte's scoping, but only ever inside .columns. */
	.columns :global(.hit) {
		fill: rgba(254, 95, 85, 0.75);
	}
	.columns :global(.dim) {
		opacity: 0.2;
	}
</style>
