<script>
	// Text that slides back and forth when it is too long to fit.
	let { text = '', size = 14, weight = 600, color = 'inherit' } = $props();
	let box = $state();
	let inner = $state();
	let dist = $state(0);

	$effect(() => {
		text; // re-measure when the text changes
		if (!box || !inner) return;
		const id = requestAnimationFrame(() => (dist = Math.max(0, inner.scrollWidth - box.clientWidth)));
		return () => cancelAnimationFrame(id);
	});
</script>

<div class="box" bind:this={box} style:font-size="{size}px" style:font-weight={weight} style:color class:fade={dist > 0}>
	{#key text}
		<span bind:this={inner} class:run={dist > 0} style:--d="-{dist}px" style:--t="{Math.max(5, dist / 24 + 4)}s">{text}</span>
	{/key}
</div>

<style>
	.box {
		overflow: hidden;
		white-space: nowrap;
		line-height: 1.3;
	}
	.box.fade {
		mask-image: linear-gradient(90deg, #000 calc(100% - 18px), transparent);
	}
	span {
		display: inline-block;
	}
	.run {
		animation: slide var(--t) ease-in-out 1.6s infinite alternate;
	}
	@keyframes slide {
		to {
			transform: translateX(var(--d));
		}
	}
</style>
