<script lang="ts">
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
</script>

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
				href={resolve(ROUTES[s], { city: cityPath })}
				aria-current={s === section ? 'page' : undefined}>{title(s)}</a
			>
		{/each}
	</nav>

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
</div>

<style>
	/*
		A definite height for the section shell.

		Nothing above this sets one: `main.bx--content` is 786px tall inside an
		800px viewport (48px of header margin plus Carbon's own min-height), so the
		document scrolled by 34px and, worse, `flex-grow` below had no fixed budget
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
		height: calc(100dvh - 3rem); /* 3rem is the Carbon header */
	}

	.sections {
		display: flex;
		align-items: stretch;
		flex: 0 0 auto;
		height: 3rem;
		padding: 0 0.5rem;
		border-bottom: 1px solid var(--cds-ui-03, #393939);
		background-color: var(--cds-ui-background, #161616);
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
		color: var(--cds-text-02, #c6c6c6);
		transition:
			color 70ms linear,
			background-color 70ms linear;
	}

	.sections a:hover {
		color: var(--cds-text-01, #f4f4f4);
		background-color: var(--cds-ui-01, #262626);
	}

	.sections a:focus-visible {
		outline: 2px solid var(--cds-focus, #ffffff);
		outline-offset: -2px;
	}

	.sections a[aria-current='page'] {
		color: var(--cds-text-01, #f4f4f4);
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
		background-color: var(--cds-interactive-01, #0f62fe);
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
		color: var(--cds-text-02, #c6c6c6);
		margin: 0;
	}
</style>
