<script lang="ts">
	import { useWatcher } from 'alova';
	import { MultiSelect, Search, Slider } from 'carbon-components-svelte';
	import { onDestroy, onMount } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import { get_greenareas_osm } from '../js/api';
	import { extent } from '../js/layers';
	import { current_city } from '../stores/stores';
	import ExploreMap from './maps/ExploreMap.svelte';
	import ToolPane from './ToolPane.svelte';

	let green_types = [
		{ text: 'village_green', id: 0 },
		{ text: 'garden', id: 1 },
		{ text: 'park', id: 2 },
		{ text: 'recreation_ground', id: 3 },
		{ text: 'grass', id: 4 },
		{ text: 'shrubbery', id: 5 },
		{ text: 'grassland', id: 6 },
		{ text: 'meadow', id: 7 },
		{ text: 'wood', id: 8 },
		{ text: 'forest', id: 9 }
	];

	// `[]` as a type annotation means "an array that can only ever be empty", which
	// is why pushing to these was an error. `data: object` likewise hid every
	// property access behind an error.
	type GreenFeature = {
		properties: { osm_value: number; osm_name: string; size: number };
	};

	let green_types_selected_ids: number[] = [];
	let green_areas_names: string[] = [];
	let current_search_text_value = '';
	let selectedResultIndex = 0;
	let current_minimum_size: number;
	let results: string[] | undefined = [];
	let data: { features: GreenFeature[] } | undefined;
	let minv = 0;
	let maxv = 0;
	// Two bindings, two variables. `ref` was bound by both the Search box and
	// ExploreMap, so the DOM node and the mapbox instance raced for one slot.
	let search_ref: HTMLInputElement | null = null;
	let map_ref: object;
	let active = false;

	let unsubscribe_greenareas_request: Unsubscriber;
	let unsubscribe_greenareas_request_error: Unsubscriber;

	let greenareas_request = useWatcher(
		() => get_greenareas_osm($current_city?.text),
		[current_city],
		{
			debounce: 500,
			immediate: true
		}
	);

	$: lowerCaseValue = current_search_text_value.toLowerCase();

	$: if (data && data.features && data.features.length > 0) {
		results = [];
		if (current_search_text_value.length > 0)
			data.features.forEach((element) => {
				if (element.properties.osm_name.toLowerCase().includes(lowerCaseValue))
					results.push(element.properties.osm_name);
			});
		else results = undefined;
	}

	$: if (data && data.features.length > 0) {
		const current_ids = new Set<number>();
		green_areas_names = [];

		// The slider bounds used to be scanned here by hand, from
		// `el.properties.size.toFixed(2)` — a STRING, so once maxv held one the
		// comparisons went lexicographic ("9.00" > "10.00" is true) — with an `else`
		// that meant a value updating maxv was never tested against minv. minv
		// therefore kept its Number.MAX_VALUE seed whenever the first element was the
		// largest, and reached the slider as Math.floor(1.79e308).
		//
		// extent() in js/layers.ts already does this correctly and is unit tested,
		// including for NaN and empty input.
		({ min: minv, max: maxv } = extent(data.features.map((el) => Number(el.properties.size))));

		data.features.forEach((el) => {
			current_ids.add(el.properties.osm_value);
			if (el.properties.osm_name) green_areas_names.push(el.properties.osm_name);
		});

		green_types_selected_ids = Array.from(current_ids);
	}

	onMount(() => {
		unsubscribe_greenareas_request_error = greenareas_request.error.subscribe((error) => {
			if (error) console.log('greenareas_request.error.subscribe', error);
		});

		unsubscribe_greenareas_request = greenareas_request.data.subscribe((value) => {
			if (value && value.features && value.features.length > 0) {
				console.log('GREEN AREAS LOADED');
				data = value;
			}
		});
	});

	onDestroy(() => {
		if (unsubscribe_greenareas_request) unsubscribe_greenareas_request();
		if (unsubscribe_greenareas_request_error) unsubscribe_greenareas_request_error();
	});
</script>

<ToolPane>
	<svelte:fragment slot="rail">
		{#if data && data.features && data.features.length > 0}
			<!--
				Ten values is where a dropdown earns its keep, so this one stays a
				MultiSelect — and unlike Create's it was already wired correctly.
			-->
			<MultiSelect
				filterable
				selectedIds={green_types_selected_ids}
				spellcheck="false"
				titleText="Green area types"
				label="Select the types of green areas"
				items={green_types}
				on:select={(event) => {
					green_types_selected_ids = event.detail.selectedIds;
				}}
			/>

			<Slider
				fullWidth
				hideTextInput
				step={1}
				labelText="Minimum size — {current_minimum_size} ha"
				min={Math.floor(minv)}
				max={Math.floor(maxv)}
				minLabel={String(Math.floor(minv))}
				maxLabel={String(Math.floor(maxv))}
				bind:value={current_minimum_size}
			/>

			<Search
				bind:ref={search_ref}
				bind:active
				bind:value={current_search_text_value}
				bind:selectedResultIndex
				{results}
				size="lg"
				placeholder="Filter by name"
				autocomplete="on"
			/>

			<p class="count">{data.features.length.toLocaleString()} green areas</p>
		{:else}
			<p class="count">Loading green areas…</p>
		{/if}
	</svelte:fragment>

	<ExploreMap
		bind:ref={map_ref}
		bind:data
		container="explore_green_areas_map"
		green_types={green_types_selected_ids}
		minimum_size={current_minimum_size}
		selected_green_areas={results}
	/>
</ToolPane>

<style>
	.count {
		color: var(--cds-text-03, #6f6f6f);
		font-size: 0.82rem;
		margin: 0;
	}

	div {
		padding: 10px 0px;
	}

	div.blocks-container {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		flex-basis: auto;
		align-items: end;
	}
	div.block {
		flex-grow: 1;
		padding: 10px 10px;
	}

	p {
		margin-top: 10px;
	}
</style>
