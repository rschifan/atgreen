<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount, type Snippet } from 'svelte';
	import { get_metadata } from '../../js/api';
	import { SECTIONS, SECTION_ROUTES, section_of, section_title } from '../../js/sections';
	import { city_label, find_city_by_param, safe_decode, to_city_path } from '../../js/slug';
	import { TargetStoreImpl } from '../../js/types';
	import { cities, current_city, metadata } from '../../stores/stores';

	let { children }: { children: Snippet } = $props();

	// The index targets and descriptions, shared by every pane below.
	onMount(() => {
		get_metadata.send().then(
			(records) => {
				if (records?.length) metadata.set(TargetStoreImpl.createInstance(records));
			},
			(error) => console.error('The index list did not load', error)
		);
	});

	const param = $derived(page.params.city ?? '');
	const features = $derived($cities?.features ?? []);

	// The URL is the source of truth for which city is open. Resolving here and
	// writing the store means a pasted link, a search selection and a back button
	// all arrive the same way, and no pane needs to know a route exists.
	const feature = $derived(find_city_by_param(features, param));
	$effect.pre(() => {
		current_city.set(feature ? { text: feature.properties.name, feature } : undefined);
	});

	// `features.length === 0` is "the city list has not arrived yet", which looks
	// identical to "no such city" if you only check `feature`. Distinguish them,
	// or a slow network renders Not found and then silently corrects itself.
	const resolving = $derived(features.length === 0);
	const notFound = $derived(!resolving && !feature);

	const cityPath = $derived(feature ? to_city_path(feature.properties.name) : param);
	const section = $derived(section_of(page.url.pathname));
	const page_title = $derived(
		feature ? `${city_label(feature.properties.name)} — ${section_title(section)}` : 'ATGreen'
	);
</script>

<svelte:head>
	<title>{page_title}</title>
</svelte:head>

<!--
	A navigation bar, not a tab strip.

	These controls change the URL and mount a different route; they do not toggle
	panels on the current page. Carbon's Tabs gave them `role="tab"` and
	`aria-selected`, which tells a screen reader to expect a tabpanel that never
	arrives, and shipped the vertical dividers and default chrome besides. A
	`<nav>` of links with `aria-current="page"` is what this actually is — and the
	styling below is ours rather than a fight with Carbon's.
-->
<div class="section-shell">
	<nav class="sections" aria-label="Sections">
		<a href={resolve('/')}>Search</a>
		{#each SECTIONS as s (s)}
			<a
				href={resolve(SECTION_ROUTES[s], { city: cityPath })}
				aria-current={s === section ? 'page' : undefined}>{section_title(s)}</a
			>
		{/each}
	</nav>

	{#if notFound}
		<div class="notice">
			<h1>No city called “{safe_decode(param)}”</h1>
			<p>
				It may have been renamed, or the link may be mistyped.
				<a href={resolve('/')}>Pick a city from the globe</a>.
			</p>
		</div>
	{:else if resolving || !$current_city}
		<div class="notice"><p>Loading cities…</p></div>
	{:else}
		<!-- One h1 per page, as the title reads; the rail and the map show the rest. -->
		<h1 class="sr-only">{page_title}</h1>
		{@render children()}
	{/if}
</div>

<style>
	/*
		A definite height for the section shell.

		Nothing above this sets one: the main element, below a 48px header, could
		grow past the viewport (under Carbon it was 786px in an 800px window, so the
		document scrolled by 34px) and, worse, `flex-grow` below had no fixed budget
		to divide. The rail's `overflow-y: auto` therefore never engaged — a rail
		taller than the window stretched the pane instead of scrolling, and the map
		canvas was left at its old size while the stage grew under it.

		Scoped to the city sections deliberately: /about and the landing page are
		documents that should scroll, this is a fixed-viewport map UI that should
		not.
	*/
	.section-shell {
		flex: 1 1 auto;
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: calc(100dvh - 3rem); /* 3rem is the app header */
	}

	.sections {
		display: flex;
		align-items: stretch;
		flex: 0 0 auto;
		height: 3rem;
		padding: 0 0.5rem;
		border-bottom: 1px solid var(--border);
		background-color: var(--background);
		/* Scrolls rather than collapsing into a dropdown on a narrow viewport. */
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: none;
	}

	.sections::-webkit-scrollbar {
		display: none;
	}

	.sections a {
		position: relative;
		display: inline-flex;
		align-items: center;
		padding: 0 1rem;
		font-size: 0.875rem;
		line-height: 1;
		white-space: nowrap;
		text-decoration: none;
		color: var(--subtle-foreground);
		transition:
			color 70ms linear,
			background-color 70ms linear;
	}

	.sections a:hover {
		color: var(--foreground);
		background-color: var(--secondary);
	}

	.sections a:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}

	.sections a[aria-current='page'] {
		color: var(--foreground);
		font-weight: 600;
	}

	/*
		The indicator sits on the bar's own bottom border rather than adding height,
		so switching section cannot shift the row by a pixel.
	*/
	.sections a[aria-current='page']::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -1px;
		height: 2px;
		background-color: var(--primary);
	}

	.notice {
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		text-align: center;
		padding: 2rem;
	}

	.notice h1 {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0;
	}

	.notice p {
		color: var(--subtle-foreground);
		margin: 0;
	}
</style>
