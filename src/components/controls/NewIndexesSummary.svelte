<script lang="ts">
	import { useWatcher } from 'alova';
	import ArrowsVertical from 'carbon-icons-svelte/lib/ArrowsVertical.svelte';
	import UserMultiple from 'carbon-icons-svelte/lib/UserMultiple.svelte';
	import { format } from 'd3';
	import { onDestroy, onMount } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import { get_city_profile } from '../../js/api';
	import { CityStoreImpl } from '../../js/types';
	import { current_accessibility_index, current_city, loading } from '../../stores/stores';

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
		() => get_city_profile($current_city?.text),
		[current_city],
		{
			debounce: 500,
			immediate: true
		}
	);

	export let metadata;

	let percentage_formatter = format('.0%');
	let data: CityStoreImpl;
	let width;
	let text;

	$: if (hovered_index) {
		text =
			percentage_formatter(data?.getIndex(hovered_index)) +
			' of the population stasfies the target for ' +
			hovered_index;
	}

	let unsubscribe_city_profile: Unsubscriber;
	let unsubscribe_change_city_event: Unsubscriber;
	let unsubscribe_change_accessibility_index_event: Unsubscriber;
	let unsubscribe_accessibility_indexes_event: Unsubscriber;

	onDestroy(() => {
		if (unsubscribe_change_city_event) unsubscribe_change_city_event();
		if (unsubscribe_change_accessibility_index_event)
			unsubscribe_change_accessibility_index_event();
		if (unsubscribe_accessibility_indexes_event) unsubscribe_accessibility_indexes_event();
		if (unsubscribe_city_profile) unsubscribe_city_profile();
	});

	onMount(() => {
		if (!unsubscribe_change_city_event) subscribe_change_city_event();
		if (!unsubscribe_change_accessibility_index_event) subscribe_change_accessibility_index_event();

		unsubscribe_city_profile = get_city_profile_request.data.subscribe((value) => {
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
				loading.set(false);
			}
		});
	});

	function subscribe_change_city_event() {
		unsubscribe_change_city_event = current_city.subscribe((city: string | undefined) => {});
	}

	function subscribe_change_accessibility_index_event() {
		unsubscribe_change_accessibility_index_event = current_accessibility_index.subscribe(
			(value: string | undefined) => {
				selected_index = value;
			}
		);
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

	function click(index: string): void {
		if (index) {
			current_accessibility_index.set(index);
		}
	}
</script>

{#if data}
	<div bind:clientWidth={width} class="index-container">
		<!--
			Real buttons. These were bare <div on:click> with an empty on:keypress
			and a svelte-ignore, and they are the ONLY way to change the index:
			`current_accessibility_index.set` is called in exactly one other place,
			the store's own default. So the app's primary control was unreachable
			by keyboard entirely (WCAG 2.1.1). `aria-pressed` now carries the state
			that was previously conveyed by background colour alone.

			The old handler also read `e.target.id` to find out which tile was
			clicked, so clicking a tile's padding rather than its label produced
			`undefined` and did nothing.
		-->
		<div class="tiles">
			{#each data.entries() as item (item[0])}
				<button
					type="button"
					class="tile"
					class:selected={$current_accessibility_index === item[0]}
					aria-pressed={$current_accessibility_index === item[0]}
					on:click={() => click(item[0])}
				>
					<span class="index-label">{item[0]}</span>
					<span class="tile-row">
						<UserMultiple size={16} />
						<span class="target-label">{percentage_formatter(item[1])}</span>
					</span>
					<span class="tile-row">
						<ArrowsVertical size={16} />
						<span class="rank-label">{data.getPercentile(item[0])}th</span>
					</span>
				</button>
			{/each}
		</div>

		<!-- `{#if metadata}` was not enough: getTarget() returns undefined for an index
		     that has not loaded yet, and .description on that throws. -->
		{#if metadata?.getTarget($current_accessibility_index)}
			<div class="description">
				What does {$current_accessibility_index} measure? {metadata.getTarget(
					$current_accessibility_index
				)?.description}
			</div>
		{/if}

		<!-- {#if $current_city}
			<div>
				{percentage_formatter(data.getIndex($current_accessibility_index))} of the population of {$current_city?.text}
				meet the target for {$current_accessibility_index}.
			</div>
		{/if} -->
	</div>
{/if}

<style>
	.tiles {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 4px;
	}

	.tile {
		display: flex;
		flex-direction: column;
		gap: 1px;
		width: 100%;
		padding: 0.45rem 0.5rem;
		border: 1px solid transparent;
		background-color: rgba(90, 90, 90, 0.2);
		color: inherit;
		font: inherit;
		font-weight: 300;
		text-align: left;
		cursor: pointer;
	}

	.tile:hover {
		background-color: rgba(120, 120, 120, 0.35);
	}

	.tile:focus-visible {
		outline: 2px solid var(--cds-focus, #ffffff);
		outline-offset: -2px;
	}

	.tile.selected {
		background-color: #0f62fe;
	}

	.tile-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.internal {
		padding-top: 5px;
		padding-bottom: 5px;
		border-top-left-radius: 5px;
		border-top-right-radius: 5px;

		background-color: rgba(90, 90, 90, 0.2);
		font-weight: 300;
	}

	.internal:hover {
		/* background-color: rgba(120, 120, 120, 0.5); */
		cursor: pointer;
		border-bottom: 2px solid;
	}

	.index-label {
		font-size: 1rem;
		font-weight: 800;
		padding-bottom: 1px;
	}
	.target-label {
		font-size: 0.85rem;
		text-align: right;
	}
	.rank-label {
		font-size: 0.85rem;
		text-align: right;
	}

	.selected {
		background-color: #0f62fe;
		border-bottom: 2px solid;
		pointer-events: none;
	}

	.index-container {
		margin: auto;
	}

	div.description {
		font-weight: 300;
		font-size: 0.9em;
	}
</style>
