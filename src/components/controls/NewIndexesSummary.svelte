<script lang="ts">
	import { useWatcher } from 'alova';
	import { Row } from 'carbon-components-svelte';
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
		<Row style="padding-left:1rem;padding-right:1rem;">
			<div style="display: flex;flex-direction: row;flex-wrap:wrap;gap:5px;">
				{#each data.entries() as item}
					<div
						style="flex-grow: 1;min-width:70px"
						class={$current_accessibility_index == item[0] ? 'selected internal' : 'internal'}
					>
						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<div
							on:click={(e) => {
								const pid = e.target.id;
								document.getElementById(pid)?.parentElement.blur();
								click(pid);
							}}
							on:keypress={(e) => {}}
							style="display: flex;flex-direction:row;flex-wrap:wrap;"
						>
							<span id={item[0]} style="flex-grow: 1;text-align: center;" class="index-label"
								>{item[0]}</span
							>
						</div>

						<div style="display:flex;flex-direction:row;flex-wrap:wrap;padding-bottom:1px">
							<UserMultiple
								size="1rem"
								class="target-icon"
								style="flex-grow: 1;text-align: right;"
							/>

							<span class="target-label" style="flex-grow: 3;text-align: center;padding-bottom:1px">
								{percentage_formatter(item[1])}
							</span>
						</div>
						<div style="display: flex;flex-direction:row;flex-wrap:wrap;">
							<ArrowsVertical size="0.85rem" style="flex-grow: 1;text-align: center;" />
							<span style="flex-grow: 3;text-align: center;" class="rank-label"
								>{data.getPercentile(item[0])}th</span
							>
						</div>
					</div>
				{/each}
			</div>
		</Row>
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
