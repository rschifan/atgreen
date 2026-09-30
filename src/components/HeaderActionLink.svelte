<!--
  Copy that uses plain svelte:component to render icon.
  Causes a codesandbox error otherwise.
-->
<script>
	/** Set to `true` to use the active state */
	export let linkIsActive = false;

	/**
	 * Specify the `href` attribute
	 * @type {string}
	 */
	export let href = undefined;

	/**
	 * Specify the icon from `carbon-icons-svelte` to render
	 * @type {typeof import("carbon-icons-svelte").CarbonIcon}
	 */
	export let icon = undefined;

	/** Obtain a reference to the HTML anchor element */
	export let ref = null;
</script>

<a
	bind:this={ref}
	class:bx--header__action={true}
	class:bx--header__action--active={linkIsActive}
	class:action-link={true}
	{href}
	rel={$$restProps.target === '_blank' ? 'noopener noreferrer' : undefined}
	{...$$restProps}
>
	<!-- 20px, like Carbon's own header actions beside it. -->
	<svelte:component this={icon} size={20} />
</a>

<style>
	.action-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
</style>
