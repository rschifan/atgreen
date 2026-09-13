<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import { get_city_profile } from '../../js/api';
	import { current_accessibility_index, current_city } from '../../stores/stores';
	import { useWatcher } from 'alova';
	import { CityStoreImpl } from '../../js/types';
	import { RadarChart } from '@carbon/charts-svelte';
	import '@carbon/charts/styles.css';

	let unsubscribe_change_city_event: Unsubscriber;
	let unsubscribe_change_accessibility_index_event: Unsubscriber;
	let unsubscribe_accessibility_indexes_event: Unsubscriber;

	let get_city_profile_request = useWatcher(
		() => get_city_profile($current_city.text),
		[current_city],
		{
			debounce: 500
		}
	);

	onDestroy(() => {
		if (unsubscribe_change_city_event) unsubscribe_change_city_event();
		if (unsubscribe_change_accessibility_index_event)
			unsubscribe_change_accessibility_index_event();
		if (unsubscribe_accessibility_indexes_event) unsubscribe_accessibility_indexes_event();
	});

	let data;

	onMount(() => {
		if (!unsubscribe_change_city_event) subscribe_change_city_event();
		if (!unsubscribe_change_accessibility_index_event) subscribe_change_accessibility_index_event();

		get_city_profile_request.data.subscribe((value) => {
			if (value) {
				data = [];
				Object.entries(value).forEach((el) => {
					data.push({
						index: el[0],
						value: Math.ceil(el[1]['v'] * 100),
						feature: 'Target'
					});
					data.push({ index: el[0], value: Math.ceil(el[1]['p']), feature: 'Rank' });
				});
				console.log(data);
			}
		});
	});

	function subscribe_change_city_event() {
		unsubscribe_change_city_event = current_city.subscribe((city: string | undefined) => {});
	}

	function subscribe_change_accessibility_index_event() {
		unsubscribe_change_accessibility_index_event = current_accessibility_index.subscribe(
			(value: string | undefined) => {
				// selected_index = value;
			}
		);
	}
</script>

{#if data}
	<RadarChart
		{data}
		options={{
			toolbar: 'false',
			title: '',
			radar: {
				axes: {
					angle: 'index',
					value: 'value'
				}
			},
			data: {
				groupMapsTo: 'feature'
			},
			height: '200px',
			theme: 'g100'
		}}
	/>
{/if}

<style>
</style>
