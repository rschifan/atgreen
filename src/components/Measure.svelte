<script lang="ts">
	import AccessibilityLayer from './layers/AccessibilityLayer.svelte';
	import BaseMap from './maps/BaseMap.svelte';

	import { onMount } from 'svelte';
	import {
		current_accessibility_index,
		current_accessibility_index_data,
		current_city
	} from '../stores/stores';
	import NewIndexesSummary from './controls/NewIndexesSummary.svelte';
	import IndexExplanationLayer from './layers/IndexExplanationLayer.svelte';
	import Legend from './plotting/Legend.svelte';
	import { ToastNotification } from 'carbon-components-svelte';

	let map;

	export let metadata;

	let styleLoaded: boolean = false;
	let mapLoaded: boolean = false;

	onMount(() => {
		current_accessibility_index.set('WHO');
		const anchor = document.getElementById('measure');
		window.scrollTo({
			top: anchor ? anchor.offsetTop - 50 : 50,
			behavior: 'smooth'
		});
	});

	let innerHeight: number;
	let innerWidth: number;

	console.log('what!', $current_accessibility_index_data);
</script>

<svelte:window bind:innerWidth bind:innerHeight />

<!-- {#if $current_accessibility_index_data} -->
<div><NewIndexesSummary {metadata} /></div>

<div style="flex-grow: 1;display: flex;flex-direction: column;">
	<BaseMap container="accessibility_map" bind:ref={map} bind:mapLoaded bind:styleLoaded>
		<Legend {metadata} containerWidth={innerWidth} />
	</BaseMap>
</div>

{#if map && mapLoaded && styleLoaded}
	<AccessibilityLayer {map} {metadata} />
	<IndexExplanationLayer {map} {metadata} />
{/if}

<!-- {:else}
	<ToastNotification
		fullWidth
		lowContrast
		kind="error"
		title="Data load error"
		subtitle="Impossibile to load the accessibility data profile for {$current_city.text}."
		caption={new Date().toLocaleString()}
		on:close={() => {
			empty_resultset_error = false;
		}}
	/>
{/if} -->

<style>
	p {
		margin-top: 10px;
	}

	div {
		padding: 10px 0px;
	}
</style>
