<script lang="ts">
	import { RadioTile, TileGroup } from 'carbon-components-svelte';
	import ArrowLeft from 'carbon-icons-svelte/lib/ArrowLeft.svelte';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { GLOBE_STYLES } from '../../js/globe_styles';
	import { globe_style } from '../../stores/settings';

	// Back returns to wherever in the app this page was opened from; opened
	// directly (a bookmark, a new tab), it goes home.
	let back = resolve('/');
	afterNavigate(({ from }) => {
		if (from?.url && from.url.pathname !== resolve('/settings'))
			back = from.url.pathname + from.url.search;
	});
</script>

<svelte:head>
	<title>Settings — ATGreen</title>
</svelte:head>

<div class="settings">
	<a class="back" href={back}><ArrowLeft /> Back</a>
	<h1>Settings</h1>

	<section aria-labelledby="globe-heading">
		<h2 id="globe-heading">Globe</h2>
		<p class="lede">
			How the home page draws the Earth and its cities. Saved in this browser; takes effect the next
			time the globe loads.
		</p>

		<TileGroup
			class="styles"
			legendText="Globe style"
			name="globe-style"
			bind:selected={$globe_style}
		>
			{#each GLOBE_STYLES as s (s.id)}
				<RadioTile value={s.id}>
					<img src="globe-styles/{s.id}.webp" alt="" width="480" height="480" loading="lazy" />
					<span class="name">{s.label}</span>
					<span class="credit">{s.credit}</span>
					<span class="description">{s.description}</span>
				</RadioTile>
			{/each}
		</TileGroup>
	</section>
</div>

<style>
	.settings {
		width: min(72rem, 100%);
		margin: 0 auto;
		padding: 2rem 1rem 4rem;
	}

	h1 {
		margin: 0 0 2rem;
		font-size: 2rem;
		font-weight: 300;
		color: #f4f4f4;
	}
	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.25rem;
		font-weight: 400;
		color: #f4f4f4;
	}
	.lede {
		max-width: 40rem;
		margin: 0 0 1.5rem;
		font-size: 0.875rem;
		line-height: 1.5;
		color: #c6c6c6;
	}

	/* The group's legend repeats the heading; keep it for screen readers only. */
	.settings :global(.styles legend) {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	.settings :global(.styles > div) {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 1rem;
	}
	.settings :global(.styles .bx--tile) {
		height: 100%;
		padding: 0.75rem 0.75rem 1rem;
	}
	.settings :global(.styles .bx--tile-content) {
		display: grid;
		gap: 0.25rem;
	}

	img {
		width: 100%;
		height: auto;
		aspect-ratio: 1;
		margin-bottom: 0.5rem;
		border-radius: 2px;
		background: #060a10;
	}
	.name {
		font-size: 1rem;
		font-weight: 600;
		color: #f4f4f4;
	}
	.credit {
		font-size: 0.75rem;
		letter-spacing: 0.02em;
		color: #6fdc8c;
	}
	.description {
		font-size: 0.875rem;
		line-height: 1.4;
		color: #c6c6c6;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		margin-bottom: 1rem;
		font-size: 0.875rem;
		color: #c6c6c6;
		text-decoration: none;
	}
	.back:hover,
	.back:focus-visible {
		color: #f4f4f4;
		text-decoration: underline;
	}
</style>
