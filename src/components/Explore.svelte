<script lang="ts">
	import type * as GeoJSON from 'geojson';
	import { useWatcher } from 'alova';
	import SearchIcon from '@lucide/svelte/icons/search';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import { onDestroy, onMount } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import { get_greenareas_osm } from '../js/api';
	import { extent } from '../js/layers';
	import { OSM_GREEN_TYPES, green_type_label } from '../js/types';
	import { current_city } from '../stores/stores';
	import { cityLabel } from '../js/slug';
	import ExploreMap from './maps/ExploreMap.svelte';
	import RailSection from './RailSection.svelte';
	import ToolPane from './ToolPane.svelte';
	import MultiSelectField from './fields/MultiSelectField.svelte';
	import RangeField from './fields/RangeField.svelte';

	// `[]` as a type annotation means "an array that can only ever be empty", which
	// is why pushing to these was an error. `data: object` likewise hid every
	// property access behind an error.
	type GreenFeature = GeoJSON.Feature<
		GeoJSON.Geometry,
		{ osm_value: number; osm_name: string; size: number }
	>;

	let green_types_selected_ids: number[] = [];
	let current_search_text_value = '';
	let current_minimum_size: number;
	let results: string[] | undefined = [];
	let data: GeoJSON.FeatureCollection<GeoJSON.Geometry, GreenFeature['properties']> | undefined;
	let minv = 0;
	let maxv = 0;

	// The OpenStreetMap values as people read them; the ids stay the numbers the
	// map filters on.
	const type_items = OSM_GREEN_TYPES.map((_, id) => ({
		id: String(id),
		text: green_type_label(id)
	}));

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

	// The selector's button says what is selected; the hint is for the one state
	// that needs explaining.
	$: types_hint =
		green_types_selected_ids.length === 0 ? 'Nothing selected — the map is empty.' : undefined;

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

		// Every type the city has starts selected.
		green_types_selected_ids = [...new Set(data.features.map((el) => el.properties.osm_value))];
	}

	onMount(() => {
		unsubscribe_greenareas_request_error = greenareas_request.error.subscribe((error) => {
			// A failed green-areas request leaves an empty map with no explanation.
			// Reporting it is the floor; surfacing it in the UI is still owed.
			if (error) console.error('Explore: green areas request failed', error);
		});

		unsubscribe_greenareas_request = greenareas_request.data.subscribe((value) => {
			if (value && value.features && value.features.length > 0) {
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
			<MultiSelectField
				title="Green area types"
				items={type_items}
				value={green_types_selected_ids.map(String)}
				onchange={(v) => (green_types_selected_ids = v.map(Number))}
				hint={types_hint}
				searchPlaceholder="Search types…"
			/>

			<RangeField
				title="Minimum size"
				unit="ha"
				min={Math.floor(minv)}
				max={Math.floor(maxv)}
				bind:value={current_minimum_size}
			/>

			<RailSection title="Find a place" for="explore-search">
				<InputGroup.Root>
					<InputGroup.Input
						id="explore-search"
						type="search"
						placeholder="Filter by name"
						autocomplete="off"
						spellcheck="false"
						bind:value={current_search_text_value}
					/>
					<InputGroup.Addon><SearchIcon /></InputGroup.Addon>
				</InputGroup.Root>
			</RailSection>

			<p class="count">
				{data.features.length.toLocaleString('en')} green areas in {cityLabel(
					$current_city?.text ?? ''
				) || 'this city'}
			</p>
		{:else}
			<p class="count">Loading green areas…</p>
		{/if}
	</svelte:fragment>

	<ExploreMap
		{data}
		container="explore_green_areas_map"
		green_types={green_types_selected_ids}
		minimum_size={current_minimum_size}
		selected_green_areas={results}
	/>
</ToolPane>

<style>
	.count {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted-foreground);
	}
</style>
