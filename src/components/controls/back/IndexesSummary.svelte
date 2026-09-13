<script lang="ts">
	import { format } from 'd3';
	import { scaleLinear } from 'd3-scale';
	import { onMount, onDestroy } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import { get_city_profile } from '../../../js/api';
	import { current_accessibility_index, current_city } from '../../../stores/stores';
	import { useWatcher } from 'alova';
	import { CityStoreImpl } from '../../../js/types';
	import { SELECTION_COLOR } from '../../../js/colors';

	const props = {
		margins: {
			top: 15,
			bottom: 10,
			right: 5,
			left: 5
		},
		stroke: { blur: 2, focus: 3 },
		circle: { max_radius: 5, min_radius: 2 },
		cell: { blur: 0.5, focus: 1.0, height: 24 },
		labels: { left: 40, right: 60 }
	};

	let get_city_profile_request = useWatcher(
		() => get_city_profile($current_city.text),
		[current_city],
		{
			debounce: 500,
			immediate: true
		}
	);

	let percentage_formatter = format('.0%');
	let logscale: boolean = false;
	let width: number;
	let n_indexes: number;
	let visible: boolean = false;
	let data: CityStoreImpl;

	let text: string;

	$: n_indexes = 8;
	$: height = props.cell.height * n_indexes + props.margins.bottom + props.margins.top;
	$: mainHeight = height - props.margins.top - props.margins.bottom;

	$: xScale = scaleLinear()
		.domain([1, 100])
		.range([0, width - props.labels.left - props.labels.right]);

	$: yScale = scaleLinear()
		.domain([0, n_indexes - 1])
		.range([0, mainHeight]);
	$: rScale = scaleLinear()
		.domain([0, 1])
		.range([props.circle.min_radius, props.circle.max_radius]);

	$: if (hovered_index) {
		text =
			percentage_formatter(data?.getIndex(hovered_index)) +
			' of the population satisfy the target for ' +
			hovered_index;
	}

	let unsubscribe_change_city_event: Unsubscriber;
	let unsubscribe_change_accessibility_index_event: Unsubscriber;
	let unsubscribe_accessibility_indexes_event: Unsubscriber;

	onDestroy(() => {
		if (unsubscribe_change_city_event) unsubscribe_change_city_event();
		if (unsubscribe_change_accessibility_index_event)
			unsubscribe_change_accessibility_index_event();
		if (unsubscribe_accessibility_indexes_event) unsubscribe_accessibility_indexes_event();
	});

	let store;
	onMount(() => {
		if (!unsubscribe_change_city_event) subscribe_change_city_event();
		if (!unsubscribe_change_accessibility_index_event) subscribe_change_accessibility_index_event();
		// unsubscribe_accessibility_indexes_event = accessibility_indexes.subscribe((value) => {
		// 	data = value;
		// });

		get_city_profile_request.data.subscribe((value) => {
			if (value) {
				data = new CityStoreImpl($current_city);

				for (let k of Object.keys(value)) {
					data.addIndex(k, value[k]['v']);
					data.addIndexPercentile(k, value[k]['p']);
					data.addIndexDeciles(
						k,
						value[k]['d']
							.substring(1, value[k]['d'].length - 1)
							.split(',')
							.map((c) => {
								return parseFloat(c);
							})
					);
				}
			}
		});
	});

	function subscribe_change_city_event() {
		unsubscribe_change_city_event = current_city.subscribe((city: string | undefined) => {
			if (city) console.log('Indexes - ', city);
		});
	}

	function subscribe_change_accessibility_index_event() {
		unsubscribe_change_accessibility_index_event = current_accessibility_index.subscribe(
			(value: string | undefined) => {
				selected_index = value;
			}
		);
	}

	function click(index: string): void {
		if (index) current_accessibility_index.set(index);
	}

	let hovered_index: string | undefined;
	let selected_index: string | undefined;
	let hovered_index_position: number;
	let hovered_index_rank: number;

	function focus(id: string, i: number, rank: number) {
		return () => {
			hovered_index = id;
			hovered_index_position = i;
			hovered_index_rank = rank;
		};
	}

	function leave() {
		hovered_index = undefined;
	}
</script>

{#if data}
	<div class="" bind:clientWidth={width}>
		<figure>
			<svg {height} {width}>
				<g transform="translate({props.margins.left + props.labels.left} {props.margins.top})">
					{#each data.entries() as [k, v], i}
						{@const active = hovered_index === k}
						{@const selected = selected_index === k}
						{@const rank = data.percentile.get(k)}
						<line
							x1={0}
							x2={xScale(rank) - rScale(v)}
							y1={yScale(i)}
							y2={yScale(i)}
							stroke={selected ? SELECTION_COLOR : 'gray'}
							stroke-width={active || selected ? 2 : 1}
							opacity={active || selected ? props.cell.focus : props.cell.blur}
						/>
						<circle
							fill={selected ? SELECTION_COLOR : active ? 'gray' : 'green'}
							cx={xScale(rank)}
							cy={yScale(i)}
							r={rScale(v)}
							stroke="white"
							stroke-width={active || selected ? props.stroke.focus : props.stroke.blur}
							opacity={active || selected ? props.cell.focus : props.cell.blur}
							on:mouseleave={leave}
							on:blur={leave}
							on:mouseover={focus(k, i, rank)}
							on:focus={focus(k, i, rank)}
							on:click={click(k)}
						/>

						<text
							dominant-baseline="auto"
							text-anchor="start"
							font-weight={selected ? 'bold' : 'normal'}
							font-size={selected ? 15 : 10}
							fill="white"
							opacity={active || selected ? props.cell.focus : props.cell.blur}
							x={xScale(rank) + rScale(v) + 3}
							y={yScale(i) - 1}
							class="small"
						>
							{percentage_formatter(v)}
						</text>
						<text
							dominant-baseline="hanging"
							text-anchor="start"
							font-weight={selected ? 'bold' : 'normal'}
							font-size="10"
							fill="white"
							opacity={active || selected ? props.cell.focus : props.cell.blur}
							x={xScale(rank) + rScale(v) + 3}
							y={yScale(i) + 1}
							class="small"
						>
							{rank <= 50 ? 'top ' + rank + '%' : 'bottom ' + (100 - rank) + '%'}
						</text>
					{/each}
				</g>

				<g transform="translate({props.margins.left} {props.margins.top})">
					{#each data.entries() as [k, v], i}
						{@const active = hovered_index === k}
						{@const selected = selected_index === k}
						{@const rank = data.percentile.get(k)}
						<text
							dominant-baseline="middle"
							text-anchor="left"
							font-weight={selected ? 'bold' : 'normal'}
							font-size="12"
							fill="white"
							opacity={active || selected ? props.cell.focus : props.cell.blur}
							x={0}
							y={yScale(i)}
							class="small"
							on:mouseleave={leave}
							on:blur={leave}
							on:mouseover={focus(k, i, rank)}
							on:focus={focus(k, i, rank)}
							on:click={click(k)}
						>
							{k}
						</text>
					{/each}
				</g>
			</svg>
		</figure>
	</div>
{/if}

<style>
	svg {
		display: block;
		margin: auto;
	}
	circle:hover,
	text:hover {
		cursor: pointer;
	}

	circle:focus,
	text:focus {
		outline: none;
	}
</style>
