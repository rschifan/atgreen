<script>
	// Carbon's dark theme, imported from the installed package rather than a CDN:
	// the version then follows package-lock.json and cannot drift under the bundle.
	import 'carbon-components-svelte/css/g100.css';
</script>

<slot />

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
