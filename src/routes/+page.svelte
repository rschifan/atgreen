<script lang="ts">
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
	import { selectAll } from 'd3';

	import { Tab, TabContent, Tabs } from 'carbon-components-svelte';

	import { onDestroy, onMount } from 'svelte';
	import { expoIn } from 'svelte/easing';

	import CompareAccessibilityIndexes from '../components/Compare.svelte';
	import ExploreGreenAreas from '../components/Explore.svelte';

	import { useRequest } from 'alova';
	import type { Unsubscriber } from 'svelte/store';
	import CitySelector from '../components/CitySelector.svelte';
	import CreateAccessibilityIndex from '../components/Create.svelte';
	import MeasureAccessibility from '../components/Measure.svelte';
	import { get_cities_metadata, get_metadata } from '../js/api';
	import { TargetStoreImpl } from '../js/types';
	import { current_city, loading } from '../stores/stores.js';
	import Draw from '../components/Draw.svelte';

	let isSideNavOpen = false;
	let isOpen = false;
	let selected = '0';
	let transitions = {
		'0': {
			text: 'Default (duration: 200ms)',
			value: { duration: 200 }
		},
		'1': {
			text: 'Custom (duration: 600ms, delay: 50ms, easing: expoIn)',
			value: { duration: 600, delay: 50, easing: expoIn }
		},
		'2': {
			text: 'Disabled',
			value: false
		}
	};

	let ref = null;
	let active = false;
	let current_search_text_value = '';
	let selectedResultIndex = 0;
	let results: [] = [];
	let events: [] = [];
	let metadata: TargetStoreImpl;
	let selectedTab = 0;

	const { _loading, data, _error } = useRequest(get_cities_metadata, {
		initialData: []
	});

	let metadata_request = useRequest(get_metadata, {
		initialData: []
	});

	let unsubscribe_current_city_event: Unsubscriber;

	onMount(() => {
		unsubscribe_current_city_event = current_city.subscribe((value) => {
			if (value) {
				if (selectedTab == 0) selectedTab = 1;
			}
		});
	});

	onDestroy(() => {
		if (unsubscribe_metadata_request) unsubscribe_metadata_request();
		if (unsubscribe_current_city_event) unsubscribe_current_city_event();
	});

	$: lowerCaseValue = current_search_text_value.toLowerCase();

	$: if ($data) {
		results = [];
		if (current_search_text_value.length > 0) {
			$data.features.forEach((element) => {
				if (element.properties.name.toLowerCase().includes(lowerCaseValue))
					results.push({ text: element.properties.name, feature: element });
			});
		}
	}

	let unsubscribe_metadata_request = metadata_request.data.subscribe((value) => {
		if (value && value.length > 0) {
			metadata = TargetStoreImpl.createInstance(value);
		}
	});

	let content_height: number;

	function handleAnchorClick(event: PointerEvent) {
		event.preventDefault();

		// `name` is a DOM attribute, so this is the string "0".."5". The panels are
		// gated on `selectedTab === n`, which a string never satisfies — the tab would
		// highlight and the panel below it render empty. `"1" >= 0` coerces, so the
		// guard below never caught it; Number() makes a bad value NaN, which does.
		const tab = Number(event?.target.name);

		if (tab >= 0) {
			selectedTab = tab;
			changeTab();
			isOpen = false;
		}
	}

	function changeTab() {
		if (selectedTab == 2) selectAll('.bx--tab-content ').classed('tabcontent', false);
		else {
			selectAll('.bx--tab-content ').classed('tabcontent', true);

			selectAll('.bx--tab-content')
				.filter(function () {
					return this.hasAttribute('hidden');
				})
				.classed('tabcontent', false);
		}
	}
</script>

<svelte:window bind:innerHeight={content_height} />

<Header
	persistentHamburgerMenu={false}
	company="ATGreen"
	platformName={$current_city?.text}
	bind:isSideNavOpen
>
	<svelte:fragment slot="skip-to-content">
		<SkipToContent />
	</svelte:fragment>

	<HeaderUtilities>
		<HeaderSearch
			bind:ref
			bind:active
			bind:value={current_search_text_value}
			bind:selectedResultIndex
			placeholder="Select a city"
			{results}
			on:active={() => {}}
			on:inactive={() => {}}
			on:clear={() => {}}
			on:select={(e) => {
				current_city.set(e.detail.selectedResult);
			}}
		/>
		<HeaderAction bind:isOpen transition={transitions[selected].value}>
			<HeaderPanelLinks>
				{#if $current_city}
					<HeaderPanelDivider>Sections</HeaderPanelDivider>
					<HeaderPanelLink name="0" href="#search" on:click={handleAnchorClick}
						>Search</HeaderPanelLink
					>
					<HeaderPanelLink name="1" href="#measure" on:click={handleAnchorClick}
						>Measure</HeaderPanelLink
					>
					<HeaderPanelLink name="2" href="#compare" on:click={handleAnchorClick}
						>Compare</HeaderPanelLink
					>
					<HeaderPanelLink name="3" href="#create" on:click={handleAnchorClick}
						>Create</HeaderPanelLink
					>
					<HeaderPanelLink name="4" href="#draw" on:click={handleAnchorClick}>Draw</HeaderPanelLink>
					<HeaderPanelLink name="5" href="#explore" on:click={handleAnchorClick}
						>Explore</HeaderPanelLink
					>
				{/if}

				<HeaderPanelDivider>AtGreen Project</HeaderPanelDivider>
				<HeaderPanelLink href="about">About</HeaderPanelLink>
				<HeaderPanelLink href="mailto:rossano.schifanella@unito.it">Contact us</HeaderPanelLink>
			</HeaderPanelLinks>
		</HeaderAction>
	</HeaderUtilities>
</Header>

<!-- <SideNav bind:isOpen={isSideNavOpen}>
	<SideNavItems>
		<SideNavLink text="Measure" href="#measure" style="scroll-margin-top: 50px;" />
		<SideNavLink text="Compare" href="#compare" />
		<SideNavLink text="Create" href="#create" />
		<SideNavLink text="Explore" href="#explore" />
		<SideNavMenu text="Explore">
			<SideNavMenuItem href="/" text="Link 1" />
			<SideNavMenuItem href="/" text="Link 2" />
			<SideNavMenuItem href="/" text="Link 3" />
		</SideNavMenu>
	</SideNavItems>
</SideNav> -->

<Content style="padding:0px;flex-grow:1;display: flex;flex-direction: column;">
	{#if $current_city}
		<Tabs
			bind:selected={selectedTab}
			on:change={(e) => {
				changeTab(e);
			}}
		>
			<Tab label="Search" />
			<Tab label="Measure" />
			<Tab label="Compare" />
			<Tab label="Create" />
			<Tab label="Draw" />
			<Tab label="Explore" />

			<!--
				Carbon renders every TabContent and hides the inactive ones, so all six
				panels used to mount at once: five Mapbox instances (five WebGL contexts,
				four of them invisible) plus a 2.8 MB green-areas fetch for the Explore
				tab whether or not anyone opened it. Gate each panel on its own tab.
			-->
			<svelte:fragment slot="content">
				<TabContent style="margin:0px;padding:0px;">
					{#if selectedTab === 0}<CitySelector bind:active {data} />{/if}
				</TabContent>
				<TabContent class="tabcontent">
					{#if selectedTab === 1}<MeasureAccessibility {metadata} />{/if}
				</TabContent>
				<TabContent>
					{#if selectedTab === 2}<CompareAccessibilityIndexes {metadata} />{/if}
				</TabContent>
				<TabContent>
					{#if selectedTab === 3}<CreateAccessibilityIndex />{/if}
				</TabContent>
				<TabContent>
					{#if selectedTab === 4}<Draw {metadata} />{/if}
				</TabContent>
				<TabContent>
					{#if selectedTab === 5}<ExploreGreenAreas />{/if}
				</TabContent>
			</svelte:fragment>
		</Tabs>
	{:else}
		<CitySelector bind:active {data} />
	{/if}
</Content>

{#if $loading}
	<Loading />
{/if}

<!-- <ToastNotification
					fullWidth
					lowContrast
					kind="error"
					title="Error"
					subtitle="An internal server error occurred."
					caption={new Date().toLocaleString()}
				/> -->

<style>
	:global(#main-content.bx--content) {
		background: none;
	}

	:global(.tabcontent) {
		flex-grow: 1;
		display: flex;
		flex-direction: column;
	}
</style>
