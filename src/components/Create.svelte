<script lang="ts">
	import {
		Button,
		Checkbox,
		ContentSwitcher,
		FormGroup,
		Slider,
		Switch,
		Tag,
		ToastNotification
	} from 'carbon-components-svelte';

	import { PlayFilled } from 'carbon-icons-svelte';
	import { format, max, min } from 'd3';
	import { onDestroy, onMount } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import { get_indexposure_esa, get_indmindistance_osm, get_indperperson_osm } from '../js/api';
	import { AccessibilityIndexType, DEFAULT_TARGET, INDEX_UNIT } from '../js/types';
	import { current_city, loading } from '../stores/stores';
	import CreateMap from './maps/CreateMap.svelte';
	import ToolPane from './ToolPane.svelte';
	import BaseLegend from './plotting/BaseLegend.svelte';
	import { get_green_types_code } from '../js/utils';

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
	let time_budget_slider_disabled: boolean;
	let create_button_disabled: boolean;

	let current_target: number;
	let current_target_min: number;
	let current_target_max: number;

	let data;

	let map;
	let styleLoaded = false;
	let mapLoaded = false;
	let unit: string;
	let empty_resultset_error = false;

	let green_types_combobox_disabled: boolean;

	const empty_geojson = { type: 'FeatureCollection', features: [] };

	$: create_button_disabled = $current_city && $current_city.text;
	$: green_types_combobox_disabled = current_index_type == AccessibilityIndexType.EXPOSURE;
	$: time_budget_slider_disabled = current_index_type == AccessibilityIndexType.MINIMUM_DISTANCE;

	$: unit = INDEX_UNIT[current_index_type] ?? 'min';

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

	/*
		Reactive, not a switch in onMount. That hook ran once, when
		`current_index_type` is always 0, so its exposure and per-person branches
		were unreachable and the target stayed on the distance default whatever
		index you picked. Its values also disagreed with the ones the map used.
	*/
	$: current_target = DEFAULT_TARGET[current_index_type] ?? 5;

	onMount(() => {
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
</script>

<ToolPane>
	<svelte:fragment slot="rail">
		<!--
			`ContentSwitcher` for a three-value choice: a dropdown cost two clicks to
			show three words, and this one had no `on:select`, so stale results stayed
			on the map after switching index.
		-->
		<div class="grp">
			<span class="bx--label">Index type</span>
			<ContentSwitcher bind:selectedIndex={current_index_type}>
				<Switch text="Distance" />
				<Switch text="Exposure" />
				<Switch text="Per person" />
			</ContentSwitcher>
		</div>

		<!--
			`bind:group` is two-way by construction. This was a MultiSelect passed
			`selectedIds` one-way with no bind and no on:select, so nothing the user
			ticked ever reached `current_green_types` and every request asked for all
			three types regardless. There is no one-way variant of this to write.
		-->
		<FormGroup legendText="Green area types">
			{#each green_types as t (t.id)}
				<Checkbox
					labelText={t.text}
					value={t.id}
					bind:group={current_green_types}
					disabled={green_types_combobox_disabled}
				/>
			{/each}
		</FormGroup>

		<!--
			`hideTextInput` removes Carbon's `<input type="number">`, which rendered
			0.5 as "0,5" under an it-IT locale. Passing both end labels fixes the
			asymmetry of giving only `maxLabel`.
		-->
		<Slider
			fullWidth
			hideTextInput
			labelText="Minimum size — {current_greenarea_size} ha"
			min={0.5}
			max={50}
			step={0.5}
			minLabel="0.5"
			maxLabel="50"
			bind:value={current_greenarea_size}
		/>

		<Slider
			fullWidth
			hideTextInput
			labelText="Time budget — {current_time_budget} min"
			min={0}
			max={15}
			minLabel="0"
			maxLabel="15"
			bind:value={current_time_budget}
			disabled={time_budget_slider_disabled}
		/>

		<Button
			disabled={!create_button_disabled}
			icon={PlayFilled}
			iconDescription="Create your own accessibility index"
			on:click={() => {
				if ($current_city) compute();
			}}>Create</Button
		>

		{#if empty_resultset_error}
			<ToastNotification
				lowContrast
				kind="error"
				title="No index generated"
				subtitle="No park with these characteristics found in {$current_city.text}."
				on:close={() => {
					empty_resultset_error = false;
				}}
			/>
		{/if}

		{#if data && data.features.length > 0}
			<Slider
				fullWidth
				hideTextInput
				labelText="Target — {current_target} {unit}"
				bind:min={current_target_min}
				bind:max={current_target_max}
				minLabel={String(current_target_min)}
				maxLabel={String(current_target_max)}
				value={current_target}
				on:change={(ev) => {
					current_target = ev.detail;
					update_cells_selected();
				}}
			/>

			<Tag type="green">{format('.1%')(cells_satisfying_target)} of cells meet the target</Tag>

			<BaseLegend index_type={current_index_type} bind:threshold={current_target} {data} />
		{/if}
	</svelte:fragment>

	{#if data && data.features.length > 0}
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
		/>
	{:else}
		<p class="empty">Choose your parameters and press Create.</p>
	{/if}
</ToolPane>

<style>
	.grp {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.empty {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--cds-text-03, #6f6f6f);
		text-align: center;
		padding: 1rem;
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
