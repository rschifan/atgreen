<script lang="ts">
	import type * as GeoJSON from 'geojson';
	import type * as maplibregl from 'maplibre-gl';
	import { Button, Modal, TooltipDefinition } from 'carbon-components-svelte';
	import Help from 'carbon-icons-svelte/lib/Help.svelte';
	import Search from 'carbon-icons-svelte/lib/Search.svelte';
	import { onMount } from 'svelte';
	import type { Readable } from 'svelte/store';
	import { onNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { findCityByParam } from '../js/slug';
	import Tutorial from './Tutorial.svelte';
	import SummaryLayer from './layers/SummaryLayer.svelte';
	import GlobleMap from './maps/GlobleMap.svelte';

	type City = GeoJSON.Feature<GeoJSON.Point, { name: string }>;

	export let active: boolean;
	// The city list store (/rpc/getcitiesinfo): a FeatureCollection of points.
	export let data: Readable<{ features: GeoJSON.Feature[] } | undefined>;

	let map: maplibregl.Map;
	let globe: GlobleMap;
	let mapLoaded = false;
	let styleLoaded = false;
	let open = false;
	// Set while the camera flies into a city: the text fades so the dive reads.
	let leaving = false;
	let userInteracting: boolean;
	let hero: HTMLDivElement;
	let hero_height = 0;

	// Where the text ends, so on narrow screens the globe can start below it.
	$: clear_top = hero && hero_height ? hero.offsetTop + hero_height : 0;

	$: summary_data = $data?.features?.length ? ($data as GeoJSON.FeatureCollection) : undefined;
	$: city_count = summary_data?.features.length;

	// The header floats, translucent, over the globe — on this page only.
	onMount(() => {
		document.body.classList.add('landing');
		return () => document.body.classList.remove('landing');
	});

	/*
		Leaving the globe for a city — by clicking its dot or through the search —
		flies the camera there first, so the city view arrives as a zoom into the
		globe rather than a jump cut. SvelteKit holds the navigation until the
		returned promise settles; fly_to() caps that wait itself.
	*/
	onNavigate(({ to, complete }) => {
		const param = to?.params?.city;
		const cities = (summary_data?.features ?? []) as City[];
		const city = param ? findCityByParam(cities, param) : undefined;
		if (!city || !globe) return;
		leaving = true;
		// A navigation cancelled mid-flight leaves this page up: bring the text back.
		complete.catch(() => (leaving = false));
		return globe.fly_to(city.geometry.coordinates as [number, number]);
	});
</script>

<div class="landing" class:leaving>
	<div class="globe">
		<GlobleMap
			bind:this={globe}
			bind:ref={map}
			bind:mapLoaded
			bind:styleLoaded
			container="globe_map"
			bind:userInteracting
			{clear_top}
		/>
	</div>

	<div class="hero" bind:this={hero} bind:clientHeight={hero_height}>
		<p class="eyebrow">
			{city_count ? city_count.toLocaleString('en') : '1,000+'} cities · 145 countries
		</p>
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
		<p class="lede">Walking access to green space, mapped neighbourhood by neighbourhood.</p>

		<div class="actions">
			<Button icon={Search} on:click={() => (active = true)}>Select a city</Button>
			<Button kind="ghost" icon={Help} on:click={() => (open = true)}>How it works</Button>
		</div>

		<section class="tools" aria-labelledby="tools-title">
			<h2 id="tools-title">In each city</h2>
			<dl>
				<dt>Measure</dt>
				<dd>where accessibility targets are met or missed</dd>
				<dt>Compare</dt>
				<dd>two indices side by side</dd>
				<dt>Create</dt>
				<dd>your own index and target</dd>
				<dt>Draw</dt>
				<dd>a new green area and see how access changes</dd>
				<dt>Explore</dt>
				<dd>green areas by type and size</dd>
			</dl>
		</section>

		<p class="hint">
			<span class="dot" aria-hidden="true"></span>
			Each dot is a city: hover for its name, click to open it.
		</p>
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

	/*
		Wide screens: the text sits left of the globe. GlobleMap frames the globe
		to the right at the same 1056px breakpoint (Carbon's `lg`).
	*/
	.hero {
		position: absolute;
		z-index: 1;
		left: clamp(1.5rem, 6vw, 6rem);
		top: 50%;
		transform: translateY(-46%);
		width: min(34rem, 38vw);
		/* Drags on the empty parts of the column reach the globe. */
		pointer-events: none;
		text-shadow: 0 1px 18px rgba(0, 0, 0, 0.55);
	}
	.hero > * {
		pointer-events: auto;
	}

	.eyebrow {
		margin: 0 0 1rem;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #6fdc8c;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.25rem, 3.6vw, 3.5rem);
		font-weight: 300;
		line-height: 1.12;
		letter-spacing: -0.01em;
		color: #f4f4f4;
		text-wrap: balance;
	}
	/* Carbon's definition trigger sets its own small font; in a heading it inherits. */
	h1 :global(.bx--tooltip__trigger.bx--tooltip__trigger--definition) {
		font: inherit;
		letter-spacing: inherit;
	}
	h1 :global(.bx--tooltip--definition .bx--tooltip__trigger) {
		border-bottom: 2px dotted rgba(111, 220, 140, 0.8);
	}
	.term {
		font-weight: 600;
		color: #ffffff;
	}

	.lede {
		margin: 1.25rem 0 0;
		max-width: 31rem;
		font-size: 1.125rem;
		line-height: 1.55;
		color: #c6c6c6;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 2rem;
		text-shadow: none;
	}

	/* What each section does: each line reads on from its verb ("Measure where…"). */
	.tools {
		margin-top: 2.25rem;
		padding-top: 1.25rem;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		text-shadow: none;
	}
	.tools h2 {
		margin: 0 0 0.75rem;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #a8a8a8;
	}
	.tools dl {
		display: grid;
		grid-template-columns: 5.5rem 1fr;
		gap: 0.5rem 1rem;
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.4;
	}
	.tools dt {
		font-weight: 600;
		color: #f4f4f4;
	}
	.tools dd {
		margin: 0;
		color: #c6c6c6;
	}

	.hint {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		margin: 2rem 0 0;
		font-size: 0.875rem;
		line-height: 1.4;
		color: #a8a8a8;
	}
	/* The same dot the globe draws, as its own legend. */
	.dot {
		flex: none;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #defbe6;
		box-shadow: 0 0 8px 3px rgba(66, 190, 101, 0.7);
	}

	/* Narrow screens: the text on top, the globe rising from the bottom edge. */
	@media (max-width: 1055.98px) {
		.hero {
			left: 1rem;
			right: 1rem;
			top: calc(3rem + clamp(1rem, 4vh, 2.5rem));
			transform: none;
			width: auto;
			text-align: center;
		}
		h1 {
			font-size: clamp(1.75rem, 7vw, 2.75rem);
		}
		.lede {
			margin-inline: auto;
			font-size: 1rem;
		}
		.actions {
			justify-content: center;
			margin-top: 1.5rem;
		}
		/*
			The globe needs the room below the call to action. The section list and
			the data line are in "How it works" and on the About page; pointing at a
			dot needs a mouse.
		*/
		.tools,
		.hint,
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

	/* Where the data comes from, bottom left on wide screens. */
	.sources {
		position: absolute;
		z-index: 1;
		left: clamp(1.5rem, 6vw, 6rem);
		bottom: 1rem;
		margin: 0;
		max-width: calc(100% - 26rem);
		font-size: 0.75rem;
		line-height: 1.4;
		color: #8d8d8d;
	}
	.sources a {
		color: #c6c6c6;
	}
	.sources a:hover {
		color: #f4f4f4;
	}

	.hero,
	.sources {
		transition: opacity 0.35s ease;
	}
	.leaving .hero,
	.leaving .sources {
		opacity: 0;
		pointer-events: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.hero,
		.sources {
			transition: none;
		}
	}

	/* The header, translucent over the sky while this page is mounted. */
	:global(body.landing .bx--header) {
		background: rgba(6, 10, 16, 0.55);
		border-bottom-color: rgba(255, 255, 255, 0.08);
		-webkit-backdrop-filter: blur(12px);
		backdrop-filter: blur(12px);
	}
</style>
