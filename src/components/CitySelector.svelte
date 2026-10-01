<script lang="ts">
	import type * as maplibregl from 'maplibre-gl';
	import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { globe_style } from '../stores/settings';
	import { cities } from '../stores/stores';
	import Tutorial from './Tutorial.svelte';
	import SummaryLayer from './layers/SummaryLayer.svelte';
	import GlobeMap from './maps/GlobeMap.svelte';

	/** Whether the city search is open. */
	let { active = $bindable(false) }: { active?: boolean } = $props();

	let map = $state.raw<maplibregl.Map>();
	let mapLoaded = $state(false);
	let styleLoaded = $state(false);
	let open = $state(false);
	let userInteracting = $state(false);
	let hero = $state<HTMLDivElement>();
	let hero_height = $state(0);

	// Where the text ends, so the globe can be framed below it.
	const clear_top = $derived(hero && hero_height ? hero.offsetTop + hero_height : 0);

	// The header floats, translucent, over the globe — on this page only.
	onMount(() => {
		document.body.classList.add('landing');
		return () => document.body.classList.remove('landing');
	});
</script>

<div class="landing" data-globe-style={$globe_style}>
	<div class="globe">
		<GlobeMap
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
			<Tooltip.Root>
				<Tooltip.Trigger class="term">accessible</Tooltip.Trigger>
				<Tooltip.Content side="bottom" class="definition">
					<strong>Three families of indices</strong>
					<span><b>Distance</b> — walk to the nearest public green area</span>
					<span><b>Exposure</b> — all green cover within a walking time</span>
					<span><b>Per person</b> — public green per resident within a walking time</span>
				</Tooltip.Content>
			</Tooltip.Root>
			are
			<span class="tail"
				><Tooltip.Root>
					<!-- No space between trigger and content: it would land before the "?". -->
					<Tooltip.Trigger class="term">urban green areas</Tooltip.Trigger><Tooltip.Content
						side="bottom"
						class="definition"
					>
						<strong>What counts as green</strong>
						<span>Public parks, grassland and forest, from OpenStreetMap.</span>
						<span>Exposure also counts private green, from ESA WorldCover 2020.</span>
					</Tooltip.Content>
				</Tooltip.Root>?</span
			>
		</h1>

		<div class="actions">
			<Button size="lg" onclick={() => (active = true)}><SearchIcon /> Select a city</Button>
			<Button size="lg" variant="ghost" onclick={() => (open = true)}
				><CircleHelpIcon /> How it works</Button
			>
		</div>

		<p class="hint">Or click a city on the globe.</p>
	</div>

	<p class="sources">
		Data: OpenStreetMap · ESA WorldCover 2020 · GHSL population 2015 · walking routes by OSRM ·
		<a href={resolve('/about')}>Method</a>
	</p>

	<!-- The dialog mounts its content only while open, so no screenshot loads until then. -->
	<Dialog.Root bind:open>
		<!-- Never taller than the screen: it scrolls inside, so Next is always reachable. -->
		<Dialog.Content class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl">
			<Dialog.Header>
				<Dialog.Title>How it works</Dialog.Title>
				<Dialog.Description>
					Five steps, from picking a city to exploring its green areas.
				</Dialog.Description>
			</Dialog.Header>
			<Tutorial />
		</Dialog.Content>
	</Dialog.Root>
</div>

{#if map && mapLoaded && styleLoaded && $cities?.features.length}
	<SummaryLayer {map} data={$cities} bind:userInteracting />
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
		color: var(--foreground);
		text-wrap: balance;
	}
	/* A defined term: its tooltip opens on hover or keyboard focus. */
	h1 :global(.term) {
		font: inherit;
		font-weight: 600;
		color: #ffffff;
		cursor: help;
		text-decoration: underline dotted 1px rgba(111, 220, 140, 0.9);
		text-underline-offset: 0.3em;
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
		color: var(--muted-foreground);
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
		color: var(--muted-foreground);
		/* Readable over the bright desert of the relief styles, too. */
		text-shadow:
			0 1px 2px rgba(0, 0, 0, 0.9),
			0 0 8px rgba(0, 0, 0, 0.6);
	}
	.sources a {
		color: var(--subtle-foreground);
	}
	.sources a:hover {
		color: var(--foreground);
	}

	/* The data line is on the About page; the globe needs the room here. */
	@media (max-width: 1055.98px) {
		.sources {
			display: none;
		}
	}

	/* The tooltip under each defined term (portalled, so styled globally). */
	:global(.definition) {
		display: grid;
		gap: 0.375rem;
		max-width: 22rem;
		font-size: 0.8125rem;
		line-height: 1.4;
		text-align: left;
	}
	:global(.definition strong),
	:global(.definition b) {
		font-weight: 600;
	}
	/* The "?" stays with the last term, never wrapping onto a line of its own. */
	.tail {
		white-space: nowrap;
	}

	/*
		The header, translucent over the sky while this page is mounted. Tint only,
		no backdrop-filter: a backdrop filter makes the header the containing block
		of its fixed descendants, and a fixed menu panel (height 100% − 3rem) then
		resolved against the 48px bar and opened with no height at all.
	*/
	:global(body.landing .app-header) {
		background: rgba(6, 10, 16, 0.72);
		border-bottom-color: rgba(255, 255, 255, 0.08);
	}
</style>
