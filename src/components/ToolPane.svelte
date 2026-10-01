<script lang="ts">
	/**
	 * The shell every tool view sits in: a fixed-width rail of controls beside a
	 * stage the map fills completely.
	 *
	 * The old panes stacked a row of form controls above a map with a hardcoded
	 * 500px height, inside a flex column that also contained a hidden panel still
	 * claiming `flex-grow: 1`. The free space went to whichever child asked for it
	 * first, which is why half the viewport was empty black above the controls.
	 *
	 * Here the stage is the only element that grows, and it is `position: relative`
	 * so its map can be `position: absolute; inset: 0`. There is no height to pass
	 * down, nothing to measure, and no arrangement of siblings that can take the
	 * space away.
	 */

	import type { Snippet } from 'svelte';

	let {
		rail,
		children,
		scroll = false
	}: {
		/** The controls. */
		rail: Snippet;
		/** The stage: a map that fills it, or Compare's scrolling columns. */
		children: Snippet;
		/** Let the stage scroll its own content instead of holding one full-bleed child. */
		scroll?: boolean;
	} = $props();
</script>

<div class="pane">
	<aside class="rail">{@render rail()}</aside>
	<div class="stage" class:scroll>{@render children()}</div>
</div>

<style>
	.pane {
		flex-grow: 1;
		display: flex;
		min-height: 0; /* or a tall stage refuses to shrink and overflows the page */
	}

	.rail {
		flex: 0 0 18.75rem; /* 300px */
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1rem;
		overflow-y: auto;
		border-right: 1px solid var(--border);
	}

	/* Each control sizes to its content; the rail's own gap does the spacing. */
	.rail > :global(*) {
		flex: 0 0 auto;
	}

	.stage {
		position: relative;
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
	}

	.stage.scroll {
		overflow-y: auto;
	}

	/*
		Below 42rem (672px) the rail becomes a drawer above the stage.
		This replaces ten `innerWidth > 500` branches in the pane components, which
		bound `<svelte:window bind:innerWidth>` and so re-rendered every component
		on every resize event — the reason Compare rebuilt all 26,440 of its SVG
		paths while a window edge was being dragged.
	*/
	@media (max-width: 41.99rem) {
		.pane {
			flex-direction: column;
		}

		.rail {
			flex: 0 0 auto;
			max-height: 45%;
			border-right: 0;
			border-bottom: 1px solid var(--border);
		}
	}
</style>
