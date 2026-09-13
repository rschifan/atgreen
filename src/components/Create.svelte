<script lang="ts">
	import {
		Button,
		ComboBox,
		MultiSelect,
		Slider,
		ToastNotification
	} from 'carbon-components-svelte';
	import Grid from 'carbon-icons-svelte/lib/Grid.svelte';

	import { PlayFilled } from 'carbon-icons-svelte';
	import { format, max, min } from 'd3';
	import { onDestroy, onMount } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import { get_indexposure_esa, get_indmindistance_osm, get_indperperson_osm } from '../js/api';
	import { AccessibilityIndexType } from '../js/types';
	import { current_city, loading } from '../stores/stores';
	import CreateMap from './maps/CreateMap.svelte';
	import BaseLegend from './plotting/BaseLegend.svelte';
	import { get_green_types_code } from '../js/utils';

	let accesseibility_index_types = [
		{ id: AccessibilityIndexType.MINIMUM_DISTANCE, text: 'minimum distance' },
		{ id: AccessibilityIndexType.EXPOSURE, text: 'exposure' },
		{ id: AccessibilityIndexType.PER_PERSON, text: 'per person' }
	];

	let green_types = [
		{ id: 'parks', text: 'parks' },
		{ id: 'forests', text: 'forests' },
		{ id: 'grass', text: 'grass' }
	];

	let current_index_type = 0;
	let current_green_types = ['parks', 'forests', 'grass'];
	let current_green_types_code = 0;
	let cells_satisfying_target = 0.25;
	// 0	{parks,forests,grass}
	// 1	{parks,forests}
	// 2	{parks,grass}
	// 3	{parks}
	// 4	{forests,grass}
	// 5	{forests}
	// 6	{grass}
	let current_time_budget = 5;
	let current_greenarea_size = 0.5;
	let time_budget_slider_disabled: boolean =
		current_index_type == AccessibilityIndexType.MINIMUM_DISTANCE;
	let create_button_disabled: boolean = $current_city && $current_city.text;

	let current_target: number;
	let current_target_min: number;
	let current_target_max: number;

	let data;

	let map;
	let styleLoaded = false;
	let mapLoaded = false;
	let unit = 'min';
	let empty_resultset_error = false;

	let green_types_combobox_disabled = false;

	const empty_geojson = { type: 'FeatureCollection', features: [] };

	$: create_button_disabled = $current_city && $current_city.text;
	$: green_types_combobox_disabled = current_index_type == AccessibilityIndexType.EXPOSURE;
	$: time_budget_slider_disabled = current_index_type == AccessibilityIndexType.MINIMUM_DISTANCE;

	// AccessibilityIndexType.MINIMUM_DISTANCE is 0, which is falsy, so this block
	// never ran for it: switching to exposure (ha) and back left the label reading
	// "ha" for a value in minutes.
	$: if (current_index_type !== undefined && current_index_type !== null) {
		switch (current_index_type) {
			case AccessibilityIndexType.MINIMUM_DISTANCE:
				unit = 'min';
				break;
			case AccessibilityIndexType.EXPOSURE:
				unit = 'ha';
				break;
			case AccessibilityIndexType.PER_PERSON:
				unit = 'sq m';
				break;
			default:
				unit = 'min';
				break;
		}
	}

	$: if (data && data.features.length > 0) {
		const accessibility_values: number[] = [...data.features.map((o: any) => o.properties.v)];

		current_target_min = Math.floor(min(accessibility_values));
		current_target_max = Math.floor(max(accessibility_values));

		update_cells_selected();
	}

	let unsubscribe_current_city: Unsubscriber;

	onDestroy(() => {
		if (unsubscribe_current_city) unsubscribe_current_city();
	});

	onMount(() => {
		switch (current_index_type) {
			case AccessibilityIndexType.MINIMUM_DISTANCE:
				current_target = 5;
				break;
			case AccessibilityIndexType.EXPOSURE:
				current_target = 1;
				break;
			case AccessibilityIndexType.PER_PERSON:
				current_target = 10;
				break;
			default:
				current_target = 5;
		}

		unsubscribe_current_city = current_city.subscribe((value) => {
			data = empty_geojson;

			if (value && map)
				map.flyTo({
					center: value.feature.geometry.coordinates,
					essential: true,
					pitch: 0,
					bearing: 0,
					animate: false
				});
		});
	});

	function compute() {
		data = empty_geojson;

		let city = $current_city.text;

		current_green_types_code = get_green_types_code(current_green_types);
		// An empty green-type selection now yields undefined rather than silently
		// meaning "all three". Refuse the request and say so, instead of sending
		// green_code=undefined to the API.
		if (current_green_types_code === undefined) {
			empty_resultset_error = true;
			return;
		}

		// FUNCTIONS:
		// indmindistance_osm(cityname text, pga_size numeric, green_code text)
		// indexposure_esa(cityname text, pga_size numeric, distance numeric)
		// indperperson_osm(cityname text, pga_size numeric, distance numeric, green_code text)

		loading.set(true);
		// Wurzburg
		let f;
		switch (current_index_type) {
			case AccessibilityIndexType.MINIMUM_DISTANCE:
				f = get_indmindistance_osm(city, current_greenarea_size, current_green_types_code);
				break;
			case AccessibilityIndexType.EXPOSURE:
				f = get_indexposure_esa(city, current_greenarea_size, current_time_budget);
				break;
			case AccessibilityIndexType.PER_PERSON:
				f = get_indperperson_osm(
					city,
					current_greenarea_size,
					current_time_budget,
					current_green_types_code
				);
				break;
			default:
				f = get_indmindistance_osm(city, current_greenarea_size, current_green_types_code);
				break;
		}

		// `f.then(r => r.json().then(...))` did not return the inner promise, so
		// .finally fired when the HEADERS arrived - the overlay vanished while a
		// multi-megabyte body was still downloading and parsing - and a rejection
		// inside the inner chain (an HTML error page, an aborted transfer) never
		// reached .catch and became an unhandled rejection. No call site checked
		// response.ok either, so a 500 body was parsed as if it were data.
		(async () => {
			try {
				const response = await f;
				if (!response.ok) throw new Error(`index request failed: HTTP ${response.status}`);
				const response_json = await response.json();
				if (response_json && response_json.features && response_json.features.length > 0) {
					data = response_json;
				} else {
					empty_resultset_error = true;
				}
			} catch (error) {
				empty_resultset_error = true;
				console.error('Create: index request failed', error);
			} finally {
				loading.set(false);
			}
		})();
	}

	function update_cells_selected() {
		if (data && data.features.length > 0) {
			const accessibility_values: number[] = [...data.features.map((o: any) => o.properties.v)];
			const n = accessibility_values.length;
			let cells;

			if (current_index_type == AccessibilityIndexType.MINIMUM_DISTANCE)
				cells = accessibility_values.filter((v) => {
					return v <= current_target;
				});
			else
				cells = accessibility_values.filter((v) => {
					return v >= current_target;
				});

			cells_satisfying_target = cells.length / n;
		}
	}

	let innerHeight: number;
	let innerWidth: number;
</script>

<svelte:window bind:innerHeight bind:innerWidth />

<div class="blocks-container">
	<div class="block">
		<ComboBox
			style="min-width: 150px;"
			titleText="Index type"
			placeholder="Select the type of accessibility index"
			bind:selectedId={current_index_type}
			items={accesseibility_index_types}
		/>
	</div>

	<div class="block">
		<MultiSelect
			selectedIds={current_green_types}
			titleText="Green area types"
			label="Select green types"
			items={green_types}
			disabled={green_types_combobox_disabled}
		/>
	</div>

	<div class="block">
		<Slider
			labelText="Minimum size (ha)"
			min={0.5}
			max={50}
			maxLabel="50"
			bind:value={current_greenarea_size}
		/>
	</div>

	<div class="block">
		<Slider
			labelText="Time budget (min)"
			min={0}
			max={15}
			maxLabel="15"
			bind:value={current_time_budget}
			disabled={time_budget_slider_disabled}
		/>
	</div>

	<div class="block">
		<Button
			disabled={!create_button_disabled}
			tooltipPosition="right"
			tooltipAlignment="end"
			icon={PlayFilled}
			iconDescription="Create your own accessibility index"
			on:click={() => {
				if ($current_city) {
					compute();
				}
			}}>Create</Button
		>
	</div>
</div>

{#if empty_resultset_error}
	<ToastNotification
		fullWidth
		lowContrast
		kind="error"
		title="Impossible to generate the accessibility index"
		subtitle="No park with these characteristics found in {$current_city.text}."
		caption={new Date().toLocaleString()}
		on:close={() => {
			empty_resultset_error = false;
		}}
	/>
{/if}

{#if data && data.features.length > 0}
	<div>
		<p>
			Select a target for your index to dinamically see which areas of the city meet the target.
		</p>
	</div>

	<div class="blocks-container">
		<div class="block">
			<Slider
				labelText={`Target (${unit})`}
				bind:min={current_target_min}
				bind:max={current_target_max}
				maxLabel={current_target_max.toString()}
				value={current_target}
				on:change={(ev) => {
					current_target = ev.detail;
					update_cells_selected();
				}}
			/>
		</div>

		<div class="block">
			<Grid size="1rem" style="margin-top: auto;" />
			<span
				style="margin-top: auto; 
					padding-left: 0.5rem; font-size: 1rem; height:1rem;"
			>
				{format('.1%')(cells_satisfying_target)}
			</span>
		</div>
	</div>

	<!-- <TooltipIcon
				tooltipText="Carbon is an open source design system by IBM."
				icon={Grid}
			/> -->
{/if}

{#if data && data.features.length > 0}
	<div style="flex-grow: 1;display: flex;flex-direction: column;">
		<CreateMap
			container="custom_accessibility_index_map"
			bind:ref={map}
			bind:mapLoaded
			bind:styleLoaded
			bind:data
			index_type={current_index_type}
			{unit}
			size={current_greenarea_size}
			distance={current_time_budget}
			bind:threshold={current_target}
		>
			<BaseLegend
				index_type={current_index_type}
				bind:threshold={current_target}
				{data}
				width={innerWidth > 500 ? 400 : innerWidth / 2}
			/>
		</CreateMap>
	</div>

	<!-- <BaseMap
				container="custom_accessibility_index_map"
				bind:ref={map}
				bind:mapLoaded
				bind:styleLoaded
			>
				<BaseLegend
					index_type={current_index_type}
					threshold={current_target}
					{data}
					width={innerWidth > 500 ? 400 : innerWidth / 2}
				/>
			</BaseMap> -->

	<!-- {#if map && mapLoaded && styleLoaded}
			<NewIndexLayer
				bind:map
				bind:data
				index_type={current_index_type}
				{unit}
				size={current_greenarea_size}
				distance={current_time_budget}
				bind:threshold={current_target}
			/>
		{/if} -->
{/if}

<style>
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

	:global(.bx--slider-text-input, .bx-slider-text-input) {
		padding: 0%;
		font-size: smaller;
	}

	:global(.bx--slider) {
		min-width: 10rem;
		max-width: 15rem;
	}

	:global(.bx--row) {
		margin-bottom: 10px;
		gap: 5px;
	}
</style>
