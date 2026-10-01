<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import { get_greenareas_osm } from '../js/api';
	import { extent } from '../js/layers';
	import { city_label } from '../js/slug';
	import { OSM_GREEN_TYPES, green_type_label, type GreenAreas } from '../js/types';
	import { current_city } from '../stores/stores';
	import MultiSelectField from './fields/MultiSelectField.svelte';
	import RangeField from './fields/RangeField.svelte';
	import ExploreMap from './maps/ExploreMap.svelte';
	import RailSection from './RailSection.svelte';
	import ToolPane from './ToolPane.svelte';

	// The OpenStreetMap values as people read them; the ids stay the numbers the
	// map filters on.
	const type_items = OSM_GREEN_TYPES.map((_, id) => ({
		id: String(id),
		text: green_type_label(id)
	}));

	let data = $state.raw<GreenAreas>();
	let selected_types = $state<number[]>([]);
	let minimum_size = $state<number>();
	let search = $state('');

	// One request per city; a response for a city already left behind is dropped.
	$effect(() => {
		const city = $current_city?.text;
		data = undefined;
		if (!city) return;
		let stale = false;
		get_greenareas_osm(city)
			.send()
			.then(
				(areas) => {
					if (stale || !areas?.features?.length) return;
					data = areas;
					// Every type the city has starts selected.
					selected_types = [...new Set(areas.features.map((f) => f.properties.osm_value))];
				},
				(error) => {
					// A failed request leaves an empty map; reporting it is the floor.
					if (!stale) console.error('Explore: green areas request failed', error);
				}
			);
		return () => {
			stale = true;
		};
	});

	// The slider's bounds. They used to be scanned by hand from a `toFixed`
	// string, so comparisons went lexicographic ("9.00" > "10.00");
	// extent() is unit tested, NaN and empty input included.
	const bounds = $derived(extent(data?.features.map((f) => Number(f.properties.size)) ?? []));

	// The names matching the search, or undefined when there is none.
	const matches = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q || !data) return undefined;
		return data.features
			.map((f) => f.properties.osm_name)
			.filter((name) => name?.toLowerCase().includes(q));
	});

	// The selector's button says what is selected; the hint is for the one state
	// that needs explaining.
	const types_hint = $derived(
		selected_types.length === 0 ? 'Nothing selected — the map is empty.' : undefined
	);
</script>

<ToolPane>
	{#snippet rail()}
		{#if data}
			<MultiSelectField
				title="Green area types"
				items={type_items}
				value={selected_types.map(String)}
				onchange={(v) => (selected_types = v.map(Number))}
				hint={types_hint}
				searchPlaceholder="Search types…"
			/>

			<RangeField
				title="Minimum size"
				unit="ha"
				min={Math.floor(bounds.min)}
				max={Math.floor(bounds.max)}
				bind:value={minimum_size}
			/>

			<RailSection title="Find a place" for="explore-search">
				<InputGroup.Root>
					<InputGroup.Input
						id="explore-search"
						type="search"
						placeholder="Filter by name"
						autocomplete="off"
						spellcheck="false"
						bind:value={search}
					/>
					<InputGroup.Addon><SearchIcon /></InputGroup.Addon>
				</InputGroup.Root>
			</RailSection>

			<p class="m-0 text-[0.8125rem] text-muted-foreground">
				{data.features.length.toLocaleString('en')} green areas in {city_label(
					$current_city?.text ?? ''
				) || 'this city'}
			</p>
		{:else}
			<p class="m-0 text-[0.8125rem] text-muted-foreground">Loading green areas…</p>
		{/if}
	{/snippet}

	<ExploreMap
		{data}
		container="explore_green_areas_map"
		green_types={selected_types}
		{minimum_size}
		selected_green_areas={matches}
	/>
</ToolPane>
