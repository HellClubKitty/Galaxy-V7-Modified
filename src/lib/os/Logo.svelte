<script>
	// The Hopium mark: a rounded H with a spark. Draws in currentColor so it follows its parent.
	let { size = null } = $props();
</script>

<svg class="mark" viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
	<path d="M3.9 3v10M11.1 5.4V13M3.9 8.2h7.2" />
	<circle cx="12.6" cy="2.9" r="1.35" class="spark" />
</svg>

<style>
	.mark {
		display: block;
		fill: none;
		stroke: currentColor;
		stroke-width: 2.3;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.spark {
		fill: currentColor;
		stroke: none;
	}
</style>
