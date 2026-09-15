<script lang="ts">
	import type { mapbox } from 'mapbox-gl';
	import { Button, Modal, TooltipDefinition } from 'carbon-components-svelte';
	import Building from 'carbon-icons-svelte/lib/Building.svelte';
	import Help from 'carbon-icons-svelte/lib/Help.svelte';
	import { onDestroy, onMount } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import Tutorial from './Tutorial.svelte';
	import SummaryLayer from './layers/SummaryLayer.svelte';
	import GlobleMap from './maps/GlobleMap.svelte';

	export let active: boolean;
	export let data: object;

	let map: mapbox.Map;
	let mapLoaded = false;
	let styleLoaded = false;
	let open = false;

	// let unsubscribe_summary_request = summary_request.data.subscribe((value) => {
	// 	if (value && value.length > 0) {
	// 		console.log('summary:', value);
	// 		data = value;
	// 	}
	// });

	let unsubscribe_summary_data: Unsubscriber;
	let summary_data;

	onMount(() => {
		unsubscribe_summary_data = data.subscribe((value) => {
			if (value && value.features && value.features.length > 0) {
				summary_data = value;
			}
		});
	});

	onDestroy(() => {
		if (unsubscribe_summary_data) unsubscribe_summary_data();
	});

	let userInteracting: boolean;

	function openTutorial() {
		open = true;
	}
</script>

<div style="position: absolute; width:100%;top:14%;text-align: center;z-index:100;">
	<div class="subtitle">
		How <TooltipDefinition align="start">
			<p slot="tooltip" class="tooltip">
				<span class="highlighted underline">
					There isn't a single definition of accessibility.
				</span>
				<span style="display: block;padding-top:5px;">
					We compute
					<span class="highlighted bold"> several families of accessibility metrics </span>
					for easy exploration and comparison.
				</span>
				<span style="display: block;padding-top:5px;"
					>Details in the <span class="bold">About</span> section.</span
				>
			</p>

			<span class="tooltip-anchor">accessible</span>
		</TooltipDefinition>
		are <TooltipDefinition align="end">
			<span slot="tooltip" class="tooltip">
				<span class="highlighted underline">
					The first step starts with defining what a green areas is.
				</span>
				<span style="display: block;padding-top:5px;">
					We focus on
					<span class="highlighted bold"> public green areas</span>
					using <span class="highlighted">OSM</span> land use and
					<span class="highlighted">satellite imagery</span> land cover data.
				</span>
				<span style="display: block;padding-top:5px;"
					>Details in the <span class="bold">About</span> section.</span
				>
			</span>
			<span class="tooltip-anchor"> urban green areas</span>
		</TooltipDefinition>?
	</div>

	<div class="subtitle" style="padding-top: 5px;">
		<Button
			on:click={() => {
				active = true;
			}}
			size="default"
			icon={Building}>Select a city</Button
		>
	</div>
</div>

<div style="z-index:100;width:100%;position:absolute;bottom:7%;" class="subtitle">
	<div class="subtitle">
		<Button
			size="small"
			on:click={openTutorial}
			kind="secondary"
			iconDescription="Tutorial"
			icon={Help}>Tutorial</Button
		>
	</div>
</div>

<div style="position: relative; flex-grow: 1;">
	<GlobleMap
		bind:ref={map}
		bind:mapLoaded
		bind:styleLoaded
		container="globe_map"
		bind:userInteracting
	/>

	<Modal
		bind:open
		modalHeading="Tutorial"
		passiveModal
		size="lg"
		on:click:button--secondary
		on:open
		on:close
		on:submit
	>
		<!--
			Carbon's Modal renders its slot whether or not it is open — it only toggles
			`class:is-visible` — so an unmounted Tutorial still put its <img> in the DOM
			and the browser fetched a 3.9 MB screenshot on every landing-page load.
		-->
		{#if open}<Tutorial />{/if}
	</Modal>
</div>

{#if map && mapLoaded && styleLoaded && summary_data}
	<SummaryLayer {map} data={summary_data} bind:userInteracting />
{/if}

<style>
	.title {
		text-align: center;
		width: 100%;
		font-size: 1.25rem;
		font-weight: bold;
		line-height: 2rem;
	}
	.subtitle {
		text-align: center;
		width: 100%;
		font-size: 1.1rem;
		font-weight: 300;
		line-height: 1.25rem;
		margin-bottom: 1.25rem;
	}

	.subtitle div {
		display: inline;
	}

	.tooltip-anchor {
		font-size: 1.1rem;
		font-weight: 500;
		outline: none;
	}
	.tooltip-anchor:focus {
		outline: none;
	}

	.tooltip {
		font-size: 0.83rem;
		font-weight: 500;
		outline: none;
	}

	.bold {
		font-weight: 600;
	}
	.highlighted {
		background-color: rgba(244, 196, 48, 0.4);
		padding: 2px;
		border-radius: 5px;
	}

	.underline {
		text-decoration: underline;
	}
</style>
