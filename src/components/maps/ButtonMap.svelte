<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Button } from 'carbon-components-svelte';
	import type { mapbox } from '../../js/mapbox';

	let button: MapControl;
	let container: HTMLDivElement;

	export let map: mapbox.Map;
	export let icon;
	export let title: string;
	export let action = () => {};

	class MapControl {
		onAdd() {
			return container;
		}

		onRemove() {}
	}

	onMount(() => {
		// console.log('MapControl - onMount');
		button = new MapControl();
		map.addControl(button, 'top-right');
	});

	onDestroy(() => {
		map.removeControl(button);
	});
</script>

<!-- <div bind:this={container} class="mapboxgl-ctrl-group mapboxgl-ctrl"> -->
<div bind:this={container} class="mapboxgl-ctrl">
	<!-- <button class="mapboxgl-ctrl-icon" on:click={action} {title}>
		<slot />
	</button> -->

	<Button
		size="small"
		kind="secondary"
		tooltipPosition="left"
		iconDescription={title}
		on:click={action}
		{icon}
	/>
</div>

<style>
</style>
