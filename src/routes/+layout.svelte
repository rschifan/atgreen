<script lang="ts">
	// Carbon's dark theme, imported from the installed package rather than a CDN:
	// the version then follows package-lock.json and cannot drift under the bundle.
	import 'carbon-components-svelte/css/g100.css';

	import {
		Content,
		Header,
		HeaderAction,
		HeaderPanelDivider,
		HeaderPanelLink,
		HeaderPanelLinks,
		HeaderSearch,
		HeaderUtilities,
		Loading,
		SkipToContent
	} from 'carbon-components-svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { useRequest } from 'alova';
	import { get_cities_metadata } from '../js/api';
	import { toCityPath } from '../js/slug';
	import { cities, current_city, loading, search_active } from '../stores/stores.js';

	const SECTIONS = ['measure', 'compare', 'create', 'draw', 'explore'] as const;

	// Route ids, not built strings: `resolve` applies any base path and is typed,
	// so renaming a section route breaks the build rather than the links.
	const ROUTES = {
		measure: '/[city]/measure',
		compare: '/[city]/compare',
		create: '/[city]/create',
		draw: '/[city]/draw',
		explore: '/[city]/explore'
	} as const;
	const title = (s: string) => s[0].toUpperCase() + s.slice(1);

	type CityFeature = { properties: { name: string } };

	let isSideNavOpen = false;
	let isOpen = false;
	let searchRef: HTMLInputElement | null = null;
	let query = '';
	let selectedResultIndex = 0;
	let results: { href: string; text: string; feature: CityFeature }[] = [];

	// One request for the whole app; the [city] layout resolves its URL segment
	// against the same store rather than fetching the list a second time.
	const { data } = useRequest(get_cities_metadata, { initialData: [] });
	$: cities.set($data);

	// `initialData: []` is truthy but has no `.features`, so guard the shape and
	// not the value — typing before the list landed used to throw right here.
	$: features = (($data && $data.features) || []) as CityFeature[];
	$: results =
		query.length > 0
			? features
					.filter((f) => f.properties.name.toLowerCase().includes(query.toLowerCase()))
					.map((f) => ({
						// Carbon calls preventDefault on the click and dispatches `select`
						// instead, so this href is not what navigates — but it makes each
						// result a real link for middle-click and copy-link-address.
						href: resolve(ROUTES[section], { city: toCityPath(f.properties.name) }),
						text: f.properties.name,
						feature: f
					}))
			: [];

	// Picking a new city keeps the section you were looking at rather than
	// dropping you back on Measure every time.
	$: section = SECTIONS.find((s) => $page.url.pathname.endsWith('/' + s)) ?? 'measure';
	// SvelteKit hands params back decoded and `resolve()` inserts them without
	// re-encoding, so this has to go back through toCityPath or the header-panel
	// links come out raw where the tab links are encoded. No city name currently
	// contains a character that changes URL meaning, but the two link builders
	// disagreeing is the kind of thing that stops being harmless quietly.
	$: cityPath = toCityPath($page.params.city ?? '');
</script>

<Header
	persistentHamburgerMenu={false}
	companyName="ATGreen"
	platformName={$current_city?.text}
	bind:isSideNavOpen
>
	<svelte:fragment slot="skipToContent">
		<SkipToContent />
	</svelte:fragment>

	<HeaderUtilities>
		<HeaderSearch
			bind:ref={searchRef}
			bind:active={$search_active}
			bind:value={query}
			bind:selectedResultIndex
			placeholder="Select a city"
			{results}
			on:select={(e) => {
				// Selecting a city is a navigation, not a state change. The [city]
				// layout resolves the segment and sets `current_city` from it, so a
				// pasted link and a click through the search land in the same place.
				const name = (e.detail.selectedResult as unknown as (typeof results)[number])?.feature
					?.properties?.name;
				if (name) goto(resolve(ROUTES[section], { city: toCityPath(name) }));
			}}
		/>
		<!--
			`iconDescription` is what gives this button an accessible name: Carbon
			renders it as assistive text inside the button. Without it the control is
			an icon with no name at all — axe reports `button-name`, critical, and a
			screen-reader user is told only "button".
		-->
		<HeaderAction
			bind:isOpen
			iconDescription="Sections and project links"
			transition={{ duration: 200 }}
		>
			<HeaderPanelLinks>
				{#if cityPath}
					<HeaderPanelDivider>Sections</HeaderPanelDivider>
					<HeaderPanelLink href={resolve('/')}>Search</HeaderPanelLink>
					{#each SECTIONS as s (s)}
						<!--
							Real hrefs. These were `#measure` anchors with a click handler
							that read `event.target.name` — a DOM attribute, so a string —
							and assigned it to a numeric tab index the `selectedTab === n`
							panel gates then failed to match: six links that highlighted a
							tab and rendered an empty panel. There is no index to mistype now.
						-->
						<HeaderPanelLink href={resolve(ROUTES[s], { city: cityPath })}
							>{title(s)}</HeaderPanelLink
						>
					{/each}
				{/if}

				<HeaderPanelDivider>AtGreen Project</HeaderPanelDivider>
				<HeaderPanelLink href={resolve('/about')}>About</HeaderPanelLink>
				<HeaderPanelLink href="mailto:rossano.schifanella@unito.it">Contact us</HeaderPanelLink>
			</HeaderPanelLinks>
		</HeaderAction>
	</HeaderUtilities>
</Header>

<Content style="padding:0px;flex-grow:1;display:flex;flex-direction:column;">
	<slot />
</Content>

{#if $loading}
	<Loading />
{/if}

<!--
	Definition-tooltip compatibility.

	carbon-components-svelte still ships TooltipDefinition, and it still emits
	`bx--tooltip--definition` / `bx--tooltip__trigger--definition`, but its own g100
	stylesheet stopped styling them: that selector appears 31 times in 0.76's CSS and
	once in 0.112's. The component renders markup its own theme no longer covers.

	Without these rules the trigger is a bare <button> falling back to the UA default
	`buttontext` — black text on a dark background, which is the bug that made this
	homepage look broken for months — and the wrapper loses `position: relative`, so
	the absolutely positioned tooltip body escapes to the page's left edge.

	The alternative was migrating to Carbon's current Tooltip, which is icon-triggered
	and would replace the two underlined phrases in "How accessible are urban green
	areas?" with icons. That is a design change, so it is deliberately not made here.
-->
<style>
	:global(#main-content.bx--content) {
		background: none;
	}

	:global(.bx--tooltip--definition) {
		position: relative;
		display: inline-block;
	}

	:global(.bx--tooltip__trigger--definition) {
		color: inherit;
		font: inherit;
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		border-bottom: 1px dotted var(--cds-text-02, #c6c6c6);
	}

	:global(.bx--tooltip__trigger--definition:focus-visible) {
		outline: 2px solid var(--cds-focus, #ffffff);
		outline-offset: 2px;
	}
</style>
