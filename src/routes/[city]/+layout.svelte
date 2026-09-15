<script lang="ts">
	import { Tab, Tabs } from 'carbon-components-svelte';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { useRequest } from 'alova';
	import { get_metadata } from '../../js/api';
	import { findCityByParam, safeDecode, toCityPath } from '../../js/slug';
	import { TargetStoreImpl } from '../../js/types';
	import { cities, current_city, metadata } from '../../stores/stores.js';

	const SECTIONS = ['measure', 'compare', 'create', 'draw', 'explore'] as const;

	// Each section is its own route, so `resolve` is given the route id rather
	// than a built string: it applies any configured base path and, being typed
	// by route id, fails the build if a section route is renamed out from under
	// these links.
	const ROUTES = {
		measure: '/[city]/measure',
		compare: '/[city]/compare',
		create: '/[city]/create',
		draw: '/[city]/draw',
		explore: '/[city]/explore'
	} as const;
	const title = (s: string) => s[0].toUpperCase() + s.slice(1);

	// The index targets and descriptions, shared by every pane below.
	// `useRequest` returns an object OF stores, not a store — destructure `data`
	// out and subscribe to that, or `$metadata_request` tries to treat the plain
	// wrapper object as a store and the whole route 500s on the server.
	const { data: index_metadata } = useRequest(get_metadata, { initialData: [] });
	$: if ($index_metadata?.length > 0) {
		metadata.set(TargetStoreImpl.createInstance($index_metadata));
	}

	$: param = $page.params.city ?? '';
	$: features = $cities?.features ?? [];

	// The URL is the source of truth for which city is open. Resolving here and
	// writing the store means a pasted link, a search selection and a back button
	// all arrive the same way, and no pane needs to know a route exists.
	$: feature = findCityByParam(features, param);
	$: current_city.set(
		feature?.properties?.name ? { text: feature.properties.name, feature } : undefined
	);

	// `features.length === 0` is "the city list has not arrived yet", which looks
	// identical to "no such city" if you only check `feature`. Distinguish them,
	// or a slow network renders Not found and then silently corrects itself.
	$: resolving = features.length === 0;
	$: notFound = !resolving && !feature;

	$: cityPath = feature?.properties?.name ? toCityPath(feature.properties.name) : param;
	$: section = SECTIONS.find((s) => $page.url.pathname.endsWith('/' + s)) ?? 'measure';
	$: selected = SECTIONS.indexOf(section) + 1; // 0 is Search
</script>

<Tabs {selected}>
	<!--
		Every tab is a real link, so a section is addressable, shareable and
		reachable with the back button. Carbon 0.112 navigates rather than
		intercepting whenever `href` is not the "#" placeholder, and SvelteKit
		takes same-origin clicks from there.

		This replaces a numeric `selectedTab` that six `{#if selectedTab === n}`
		gates compared against, and a d3 pass that added and removed a class on
		the panels to give them height. Both are gone: the route decides what
		mounts, and there is no index to get wrong.
	-->
	<Tab label="Search" href={resolve('/')} />
	{#each SECTIONS as s (s)}
		<Tab label={title(s)} href={resolve(ROUTES[s], { city: cityPath })} />
	{/each}
</Tabs>

{#if notFound}
	<div class="notice">
		<h1>No city called “{safeDecode(param)}”</h1>
		<p>
			It may have been renamed, or the link may be mistyped.
			<a href={resolve('/')}>Pick a city from the globe</a>.
		</p>
	</div>
{:else if resolving}
	<div class="notice"><p>Loading cities…</p></div>
{:else}
	<slot />
{/if}

<style>
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
		color: var(--cds-text-02, #c6c6c6);
		margin: 0;
	}
</style>
