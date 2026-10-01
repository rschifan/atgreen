<script lang="ts">
	import Measure from '../../../components/Measure.svelte';
	import { metadata } from '../../../stores/stores';
</script>

<Measure metadata={$metadata} />
