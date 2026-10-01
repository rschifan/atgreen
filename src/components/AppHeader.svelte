<script lang="ts">
	/*
		The app header, built from shadcn-svelte parts (src/lib/components/ui). It
		replaces Carbon's UI shell: the name links home, the city search is a
		command palette, Settings is a gear, and the sections and project links sit
		in a menu. It keeps Carbon's 3rem height and stacking order, which the rest
		of the layout is measured against.
	*/
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Kbd } from '$lib/components/ui/kbd/index.js';
	import { SECTIONS, SECTION_ROUTES, section_of, section_title } from '../js/sections';
	import { city_label, city_matches, to_city_path, to_slug } from '../js/slug';
	import { cities, current_city, search_active } from '../stores/stores';

	// The palette lists at most this many matches; typing narrows them.
	const MAX_RESULTS = 50;

	let query = $state('');

	const features = $derived($cities?.features ?? []);
	// Before anything is typed, suggest the largest cities (by grid size).
	const suggestions = $derived(
		[...features].sort((a, b) => b.properties.nrows - a.properties.nrows).slice(0, 8)
	);
	// Best matches first: names that start with what was typed, then names with a
	// word that does ("Antonio" in "San Antonio"), then the rest; each A–Z.
	const rank = (name: string, q: string) => {
		const n = to_slug(name);
		return n.startsWith(q) ? 0 : n.includes('-' + q) ? 1 : 2;
	};
	const shown = $derived.by(() => {
		if (!query.trim()) return suggestions;
		const q = to_slug(query);
		return features
			.filter((f) => city_matches(f.properties.name, query))
			.sort(
				(a, b) =>
					rank(a.properties.name, q) - rank(b.properties.name, q) ||
					city_label(a.properties.name).localeCompare(city_label(b.properties.name))
			)
			.slice(0, MAX_RESULTS);
	});

	// Picking a new city keeps the section you were looking at.
	const section = $derived(section_of(page.url.pathname));
	// Params come back decoded; to_city_path re-encodes, as the section tabs do.
	const cityPath = $derived(to_city_path(page.params.city ?? ''));
	const on_settings = $derived(page.url.pathname === resolve('/settings'));

	// Selecting a city is a navigation; the [city] layout resolves the segment.
	function open_city(name: string) {
		search_active.set(false);
		query = '';
		goto(resolve(SECTION_ROUTES[section], { city: to_city_path(name) }));
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

<svelte:window onkeydown={on_key} />

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
		<span class="truncate text-sm">{city_label($current_city.text)}</span>
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
									<a href={resolve(SECTION_ROUTES[s], { city: cityPath })} {...props}
										>{section_title(s)}</a
									>
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
						{city_label(f.properties.name)}
					</Command.Item>
				{/each}
			</Command.Group>
		{:else}
			<!-- A listbox must hold options: say "no match" as one that cannot be picked. -->
			<Command.Item value="no-match" disabled>No city matches “{query.trim()}”.</Command.Item>
		{/if}
	</Command.List>
</Command.Dialog>
