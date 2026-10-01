<script lang="ts">
	import PlayIcon from '@lucide/svelte/icons/play';
	import { format } from 'd3';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { get_custom_index } from '../js/api';
	import { extent } from '../js/layers';
	import { toast_no_index } from '../js/notify';
	import {
		AccessibilityIndexType,
		DEFAULT_TARGET,
		INDEX_UNIT,
		type ComputedGrid
	} from '../js/types';
	import { get_green_types_code } from '../js/utils';
	import { current_city, loading } from '../stores/stores';
	import IndexParamsFields from './fields/IndexParamsFields.svelte';
	import RangeField from './fields/RangeField.svelte';
	import CreateMap from './maps/CreateMap.svelte';
	import Legend from './plotting/Legend.svelte';
	import ToolPane from './ToolPane.svelte';

	let type = $state(AccessibilityIndexType.MINIMUM_DISTANCE);
	let green_types = $state(['parks', 'forests', 'grass']);
	let size = $state(0.5);
	let time = $state(5);
	let target = $state(DEFAULT_TARGET[AccessibilityIndexType.MINIMUM_DISTANCE]);

	let data = $state.raw<ComputedGrid>();
	/*
		The parameters `data` was built with. The map, legend and target read these,
		not the rail: changing the rail after a run used to re-label the result on
		screen with the new type's units and colours, over the old type's numbers.
	*/
	let shown = $state<{ type: AccessibilityIndexType; size: number; time: number }>();

	// Another city's result does not belong on this one.
	$effect(() => {
		if ($current_city) data = undefined;
	});

	const values = $derived(data?.features.map((f) => f.properties.v) ?? []);
	const range = $derived(extent(values));
	const share = $derived.by(() => {
		const meets = (v: number) =>
			shown?.type === AccessibilityIndexType.MINIMUM_DISTANCE ? v <= target : v >= target;
		return values.filter(meets).length / (values.length || 1);
	});

	async function compute() {
		data = undefined;
		// An empty green-type selection has no code; refuse it rather than ask the
		// API for every type, which is what it used to fall back to.
		const green_code = get_green_types_code(green_types);
		if (!$current_city || green_code === undefined) return toast_no_index($current_city?.text);

		const params = { type, size, time };
		loading.set(true);
		try {
			const result = await get_custom_index(
				params.type,
				$current_city.text,
				params.size,
				params.time,
				green_code
			);
			if (!result) return toast_no_index($current_city.text);
			shown = params;
			target = DEFAULT_TARGET[params.type];
			data = result;
		} catch (error) {
			toast_no_index($current_city.text);
			console.error('Create: index request failed', error);
		} finally {
			loading.set(false);
		}
	}
</script>

<ToolPane>
	{#snippet rail()}
		<IndexParamsFields bind:type bind:green_types bind:size bind:time />

		<Button disabled={!$current_city} onclick={compute}><PlayIcon /> Create</Button>

		{#if data && shown}
			<RangeField
				title="Target"
				unit={INDEX_UNIT[shown.type]}
				min={Math.floor(range.min)}
				max={Math.floor(range.max)}
				bind:value={target}
			/>
			<Badge variant="outline" class="self-start border-primary/40 text-primary">
				{format('.1%')(share)} of cells meet the target
			</Badge>
		{/if}
	{/snippet}

	{#if data && shown}
		<CreateMap
			container="custom_accessibility_index_map"
			{data}
			index_type={shown.type}
			size={shown.size}
			distance={shown.time}
			threshold={target}
		>
			<Legend {values} type={shown.type} threshold={target} />
		</CreateMap>
	{:else}
		<p
			class="absolute inset-0 m-0 flex items-center justify-center p-4 text-center text-muted-foreground"
		>
			Choose your parameters and press Create.
		</p>
	{/if}
</ToolPane>
