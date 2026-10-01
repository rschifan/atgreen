<script lang="ts">
	/*
		The app header, built from shadcn-svelte parts (src/lib/components/ui). It
		replaces Carbon's UI shell: the name links home, the city search is a
		command palette, Settings is a gear, and the sections and project links sit
		in a menu. It keeps Carbon's 3rem height and stacking order, which the rest
		of the layout is measured against.
	*/
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Kbd } from '$lib/components/ui/kbd/index.js';
	import { cityLabel, cityMatches, toCityPath, toSlug } from '../js/slug';
	import { cities, current_city, search_active } from '../stores/stores.js';

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

	type CityFeature = { properties: { name: string; nrows?: number } };

	// The palette lists at most this many matches; typing narrows them.
	const MAX_RESULTS = 50;

	let query = '';

	// `cities` starts as `[]` (truthy, no `.features`) until the list lands.
	$: features = (($cities && $cities.features) || []) as CityFeature[];
	// Before anything is typed, suggest the largest cities (by grid size).
	$: suggestions = [...features]
		.sort((a, b) => (b.properties.nrows ?? 0) - (a.properties.nrows ?? 0))
		.slice(0, 8);
	// Best matches first: names that start with what was typed, then names with a
	// word that does ("Antonio" in "San Antonio"), then the rest; each A–Z.
	const rank = (name: string, q: string) => {
		const n = toSlug(name);
		return n.startsWith(q) ? 0 : n.includes('-' + q) ? 1 : 2;
	};
	$: q = toSlug(query);
	$: shown = query.trim()
		? features
				.filter((f) => cityMatches(f.properties.name, query))
				.sort(
					(a, b) =>
						rank(a.properties.name, q) - rank(b.properties.name, q) ||
						cityLabel(a.properties.name).localeCompare(cityLabel(b.properties.name))
				)
				.slice(0, MAX_RESULTS)
		: suggestions;

	// Picking a new city keeps the section you were looking at.
	$: section = SECTIONS.find((s) => $page.url.pathname.endsWith('/' + s)) ?? 'measure';
	// Params come back decoded; toCityPath re-encodes, as the section tabs do.
	$: cityPath = toCityPath($page.params.city ?? '');
	$: on_settings = $page.url.pathname === resolve('/settings');

	// Selecting a city is a navigation; the [city] layout resolves the segment.
	function open_city(name: string) {
		search_active.set(false);
		query = '';
		goto(resolve(ROUTES[section], { city: toCityPath(name) }));
	}

	// "/" or Ctrl/⌘-K opens the search from anywhere, except while typing.
	function on_key(e: KeyboardEvent) {
		const t = e.target as HTMLElement | null;
		const typing =
			!!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
		if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
			e.preventDefault();
			search_active.set(true);
		}
	}
</script>

<svelte:window on:keydown={on_key} />

<header
	class="app-header fixed inset-x-0 top-0 z-[8000] flex h-12 items-center gap-2 border-b border-border bg-background px-3 text-foreground sm:px-4"
>
	<a
		href="#main-content"
		class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:ring-2 focus:ring-ring"
		>Skip to main content</a
	>

	<a
		href={resolve('/')}
		class="text-sm font-semibold tracking-wide text-foreground no-underline hover:text-white"
		>ATGreen</a
	>
	{#if $current_city}
		<span class="text-muted-foreground" aria-hidden="true">/</span>
		<span class="truncate text-sm">{cityLabel($current_city.text)}</span>
	{/if}

	<div class="ml-auto flex items-center gap-1">
		<Button
			variant="ghost"
			class="h-8 gap-2 px-2 text-muted-foreground hover:text-foreground"
			onclick={() => search_active.set(true)}
		>
			<SearchIcon />
			<span class="hidden sm:inline">Search a city</span>
			<Kbd class="hidden sm:inline-flex">/</Kbd>
		</Button>

		<Button
			href={resolve('/settings')}
			variant="ghost"
			size="icon"
			aria-label="Settings"
			aria-current={on_settings ? 'page' : undefined}
			class={on_settings ? 'bg-accent' : ''}
		>
			<SettingsIcon />
		</Button>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class={buttonVariants({ variant: 'ghost', size: 'icon' })}
				aria-label="Menu"
			>
				<MenuIcon />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class="z-[8001] w-52">
				{#if cityPath}
					<DropdownMenu.Group>
						<DropdownMenu.Label>Sections</DropdownMenu.Label>
						{#each SECTIONS as s (s)}
							<DropdownMenu.Item>
								{#snippet child({ props })}
									<a href={resolve(ROUTES[s], { city: cityPath })} {...props}>{title(s)}</a>
								{/snippet}
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.Group>
					<DropdownMenu.Separator />
				{/if}
				<DropdownMenu.Group>
					<DropdownMenu.Label>ATGreen</DropdownMenu.Label>
					<DropdownMenu.Item>
						{#snippet child({ props })}
							<a href={resolve('/about')} {...props}>About</a>
						{/snippet}
					</DropdownMenu.Item>
					<DropdownMenu.Item>
						{#snippet child({ props })}
							<a href={resolve('/settings')} {...props}>Settings</a>
						{/snippet}
					</DropdownMenu.Item>
					<DropdownMenu.Item>
						{#snippet child({ props })}
							<a href="mailto:rossano.schifanella@unito.it" {...props}>Contact us</a>
						{/snippet}
					</DropdownMenu.Item>
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
</header>

<Command.Dialog
	bind:open={$search_active}
	shouldFilter={false}
	title="Select a city"
	description="Search the cities by name; accents and case do not matter."
>
	<!-- aria-controls: the input names the list it drives (bits-ui leaves it out). -->
	<Command.Input placeholder="Search a city…" bind:value={query} aria-controls="city-results" />
	<Command.List id="city-results">
		{#if shown.length}
			<Command.Group heading={query.trim() ? undefined : 'Largest cities'}>
				{#each shown as f (f.properties.name)}
					<Command.Item value={f.properties.name} onSelect={() => open_city(f.properties.name)}>
						{cityLabel(f.properties.name)}
					</Command.Item>
				{/each}
			</Command.Group>
		{:else}
			<!-- A listbox must hold options: say "no match" as one that cannot be picked. -->
			<Command.Item value="no-match" disabled>No city matches “{query.trim()}”.</Command.Item>
		{/if}
	</Command.List>
</Command.Dialog>
