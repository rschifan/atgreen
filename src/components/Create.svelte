<script lang="ts">
	import PlayIcon from '@lucide/svelte/icons/play';
	import type * as GeoJSON from 'geojson';
	import { format, max, min } from 'd3';
	import { toast } from 'svelte-sonner';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { get_custom_index } from '../js/api';
	import { cityLabel } from '../js/slug';
	import { AccessibilityIndexType, DEFAULT_TARGET, INDEX_UNIT } from '../js/types';
	import { get_green_types_code } from '../js/utils';
	import { current_city, loading } from '../stores/stores';
	import CreateMap from './maps/CreateMap.svelte';
	import Legend from './plotting/Legend.svelte';
	import ToolPane from './ToolPane.svelte';
	import GreenTypesField from './fields/GreenTypesField.svelte';
	import IndexTypeField from './fields/IndexTypeField.svelte';
	import RangeField from './fields/RangeField.svelte';
	import TimeBudgetField from './fields/TimeBudgetField.svelte';

	let current_index_type = AccessibilityIndexType.MINIMUM_DISTANCE;
	let current_green_types = ['parks', 'forests', 'grass'];
	let current_time_budget = 5;
	let current_greenarea_size = 0.5;
	let current_target: number;

	let data: GeoJSON.FeatureCollection | undefined;
	/*
		The parameters `data` was built with. The map, legend and target read these,
		not the rail: changing the rail after a run used to re-label the result on
		screen with the new type's units and colours, over the old type's numbers.
	*/
	let shown: { type: AccessibilityIndexType; size: number; time: number } | undefined;

	// Another city's result does not belong on this one.
	$: if ($current_city) data = undefined;

	$: values = data?.features.map((f) => f.properties?.v as number) ?? [];
	$: lower_is_better = shown?.type === AccessibilityIndexType.MINIMUM_DISTANCE;
	$: share =
		values.filter((v) => (lower_is_better ? v <= current_target : v >= current_target)).length /
		(values.length || 1);

	// An index that came back empty, or a request that failed, is said once in a
	// toast rather than left as a notification block in the rail.
	function no_index() {
		toast.error('No index generated', {
			description: `No park with these characteristics found in ${cityLabel($current_city?.text)}.`
		});
	}

	async function compute() {
		data = undefined;
		// An empty green-type selection has no code; refuse it rather than ask the
		// API for every type, which is what it used to fall back to.
		const green_code = get_green_types_code(current_green_types);
		if (!$current_city || green_code === undefined) return no_index();

		const params = {
			type: current_index_type,
			size: current_greenarea_size,
			time: current_time_budget
		};
		loading.set(true);
		try {
			const result = await get_custom_index(
				params.type,
				$current_city.text,
				params.size,
				params.time,
				green_code
			);
			if (!result) return no_index();
			shown = params;
			current_target = DEFAULT_TARGET[params.type];
			data = result;
		} catch (error) {
			no_index();
			console.error('Create: index request failed', error);
		} finally {
			loading.set(false);
		}
	}
</script>

<ToolPane>
	<svelte:fragment slot="rail">
		<IndexTypeField bind:value={current_index_type} />
		<GreenTypesField
			bind:value={current_green_types}
			disabled={current_index_type === AccessibilityIndexType.EXPOSURE}
		/>
		<RangeField
			title="Minimum size"
			unit="ha"
			min={0.5}
			max={50}
			step={0.5}
			bind:value={current_greenarea_size}
		/>
		<TimeBudgetField
			bind:value={current_time_budget}
			disabled={current_index_type === AccessibilityIndexType.MINIMUM_DISTANCE}
		/>

		<Button disabled={!$current_city} onclick={compute}><PlayIcon /> Create</Button>

		{#if data && shown}
			<RangeField
				title="Target"
				unit={INDEX_UNIT[shown.type]}
				min={Math.floor(min(values) ?? 0)}
				max={Math.floor(max(values) ?? 0)}
				bind:value={current_target}
			/>
			<Badge variant="outline" class="self-start border-primary/40 text-primary">
				{format('.1%')(share)} of cells meet the target
			</Badge>
		{/if}
	</svelte:fragment>

	{#if data && shown}
		<CreateMap
			container="custom_accessibility_index_map"
			{data}
			index_type={shown.type}
			size={shown.size}
			distance={shown.time}
			threshold={current_target}
		>
			<Legend {values} type={shown.type} threshold={current_target} />
		</CreateMap>
	{:else}
		<p class="empty">Choose your parameters and press Create.</p>
	{/if}
</ToolPane>

<style>
	.empty {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted-foreground);
		text-align: center;
		padding: 1rem;
	}
</style>
