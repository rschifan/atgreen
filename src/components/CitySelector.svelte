<script lang="ts">
	import type * as GeoJSON from 'geojson';
	import type * as maplibregl from 'maplibre-gl';
	import { Button, Modal, TooltipDefinition } from 'carbon-components-svelte';
	import Help from 'carbon-icons-svelte/lib/Help.svelte';
	import Search from 'carbon-icons-svelte/lib/Search.svelte';
	import { onMount } from 'svelte';
	import type { Readable } from 'svelte/store';
	import { resolve } from '$app/paths';
	import { globe_style } from '../stores/settings';
	import Tutorial from './Tutorial.svelte';
	import SummaryLayer from './layers/SummaryLayer.svelte';
	import GlobleMap from './maps/GlobleMap.svelte';

	export let active: boolean;
	// The city list store (/rpc/getcitiesinfo): a FeatureCollection of points.
	export let data: Readable<{ features: GeoJSON.Feature[] } | undefined>;

	let map: maplibregl.Map;
	let mapLoaded = false;
	let styleLoaded = false;
	let open = false;
	let userInteracting: boolean;
	let hero: HTMLDivElement;
	let hero_height = 0;

	// Where the text ends, so the globe can be framed below it.
	$: clear_top = hero && hero_height ? hero.offsetTop + hero_height : 0;

	$: summary_data = $data?.features?.length ? ($data as GeoJSON.FeatureCollection) : undefined;

	// The header floats, translucent, over the globe — on this page only.
	onMount(() => {
		document.body.classList.add('landing');
		return () => document.body.classList.remove('landing');
	});
</script>

<div class="landing" data-globe-style={$globe_style}>
	<div class="globe">
		<GlobleMap
			bind:ref={map}
			bind:mapLoaded
			bind:styleLoaded
			container="globe_map"
			bind:userInteracting
			{clear_top}
		/>
	</div>

	<!-- Keeps the text readable when a zoomed-in globe and its labels run under it. -->
	<div class="scrim" style:height="{clear_top + 64}px" aria-hidden="true"></div>

	<div class="hero" bind:this={hero} bind:clientHeight={hero_height}>
		<h1>
			How
			<TooltipDefinition align="start">
				<span slot="tooltip" class="definition">
					<strong>Three families of indices</strong>
					<span><b>Distance</b> — walk to the nearest public green area</span>
					<span><b>Exposure</b> — all green cover within a walking time</span>
					<span><b>Per person</b> — public green per resident within a walking time</span>
				</span>
				<span class="term">accessible</span>
			</TooltipDefinition>
			are
			<span class="tail">
				<TooltipDefinition align="end">
					<span slot="tooltip" class="definition">
						<strong>What counts as green</strong>
						<span>Public parks, grassland and forest, from OpenStreetMap.</span>
						<span>Exposure also counts private green, from ESA WorldCover 2020.</span>
					</span>
					<span class="term">urban green areas</span></TooltipDefinition
				>?</span
			>
		</h1>

		<div class="actions">
			<Button icon={Search} on:click={() => (active = true)}>Select a city</Button>
			<Button kind="ghost" icon={Help} on:click={() => (open = true)}>How it works</Button>
		</div>

		<p class="hint">Or click a city on the globe.</p>
	</div>

	<p class="sources">
		Data: OpenStreetMap · ESA WorldCover 2020 · GHSL population 2015 · walking routes by OSRM ·
		<a href={resolve('/about')}>Method</a>
	</p>

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
	/*
		Full-bleed: the globe and its sky run under the header, which turns
		translucent here, instead of starting below a solid bar.
	*/
	.landing {
		position: fixed;
		inset: 0;
		overflow: hidden;
		background: #060a10;
	}
	.globe {
		position: absolute;
		inset: 0;
	}

	.scrim {
		position: absolute;
		z-index: 1;
		inset: 0 0 auto;
		pointer-events: none;
		background: linear-gradient(
			to bottom,
			rgba(6, 10, 16, 0.92) 0%,
			rgba(6, 10, 16, 0.85) 70%,
			rgba(6, 10, 16, 0) 100%
		);
	}

	/* One centred column at every size: the question, then the globe below it. */
	.hero {
		position: absolute;
		z-index: 1;
		top: calc(3rem + clamp(1rem, 4vh, 2.5rem));
		left: 50%;
		transform: translateX(-50%);
		width: min(46rem, calc(100% - 2rem));
		text-align: center;
		/* Drags on the empty parts of the column reach the globe. */
		pointer-events: none;
		text-shadow: 0 1px 18px rgba(0, 0, 0, 0.55);
	}
	.hero > * {
		pointer-events: auto;
	}

	h1 {
		margin: 0;
		/*
			On one scale with the rest of the page: about twice the 14px of the
			buttons and the hint (28.8px at 1440px wide, 30px at most), in regular
			weight with semibold for the defined terms — not light against bold.
		*/
		font-size: clamp(1.5rem, 2vw, 1.875rem);
		font-weight: 400;
		line-height: 1.25;
		color: #f4f4f4;
		text-wrap: balance;
	}
	/* Carbon's definition trigger sets its own small font; in a heading it inherits. */
	h1 :global(.bx--tooltip__trigger.bx--tooltip__trigger--definition) {
		font: inherit;
		letter-spacing: inherit;
	}
	h1 :global(.bx--tooltip--definition .bx--tooltip__trigger) {
		border-bottom: 1px dotted rgba(111, 220, 140, 0.9);
	}
	.term {
		font-weight: 600;
		color: #ffffff;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.75rem;
		margin-top: 1.25rem;
		text-shadow: none;
	}

	.hint {
		margin: 0.75rem 0 0;
		font-size: 0.875rem;
		line-height: 1.4;
		color: #a8a8a8;
	}

	/* Where the data comes from, bottom left. */
	.sources {
		position: absolute;
		z-index: 1;
		left: 1.5rem;
		bottom: 1rem;
		margin: 0;
		max-width: calc(100% - 26rem);
		font-size: 0.75rem;
		line-height: 1.4;
		color: #a8a8a8;
		/* Readable over the bright desert of the relief styles, too. */
		text-shadow:
			0 1px 2px rgba(0, 0, 0, 0.9),
			0 0 8px rgba(0, 0, 0, 0.6);
	}
	.sources a {
		color: #c6c6c6;
	}
	.sources a:hover {
		color: #f4f4f4;
	}

	/* The data line is on the About page; the globe needs the room here. */
	@media (max-width: 1055.98px) {
		.sources {
			display: none;
		}
	}

	/* The tooltip text under each defined term. */
	.definition {
		display: grid;
		gap: 0.375rem;
		font-size: 0.8125rem;
		font-weight: 400;
		line-height: 1.4;
		letter-spacing: 0;
		text-align: left;
		text-shadow: none;
	}
	.definition strong,
	.definition b {
		font-weight: 600;
	}
	/*
		Carbon's component also emits a whitespace text node after itself, straight
		into the heading — the space before the "?". Inside an inline flex box,
		whitespace-only text is not rendered, and the "?" cannot wrap on its own.
	*/
	.tail {
		display: inline-flex;
		align-items: baseline;
	}

	/* Carbon caps definition tooltips at 13rem, which wraps every line here. */
	h1 :global(.bx--tooltip--definition .bx--tooltip__trigger + .bx--assistive-text) {
		max-width: 22rem;
	}
	/*
		Carbon's template leaves a whitespace text node after the trigger button,
		which rendered as a space before the "?". A flex container does not render
		whitespace-only text between its items.
	*/
	h1 :global(.bx--tooltip--definition) {
		display: inline-flex;
	}

	/*
		The header, translucent over the sky while this page is mounted. Tint only,
		no backdrop-filter: a backdrop filter makes the header the containing block
		of its fixed descendants, and Carbon's menu panel (fixed, height 100% − 3rem)
		then resolved against the 48px bar and opened with no height at all.
	*/
	:global(body.landing .app-header) {
		background: rgba(6, 10, 16, 0.72);
		border-bottom-color: rgba(255, 255, 255, 0.08);
	}
</style>
