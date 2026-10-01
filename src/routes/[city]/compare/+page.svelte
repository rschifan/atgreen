<script lang="ts">
	import Compare from '../../../components/Compare.svelte';
	import { metadata } from '../../../stores/stores';
</script>

<Compare metadata={$metadata} />
