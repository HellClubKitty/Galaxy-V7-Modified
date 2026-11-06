<script>
	import { prefs } from './prefs.svelte.js';
	let { app, size = 32 } = $props();
	const tile = $derived(prefs.iconStyle === 'tile');
</script>

<span class="ai" class:tile style:--s="{size}px" style:--tint={app.tint ?? '#3a3d42'}>
	<img src={app.icon} alt="" draggable="false" />
</span>

<style>
	.ai {
		flex: none;
		display: grid;
		place-items: center;
		width: var(--s);
		height: var(--s);
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		pointer-events: none;
		filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35));
	}
	.tile {
		border-radius: 23%;
		background: linear-gradient(180deg, color-mix(in srgb, var(--tint) 88%, #fff), var(--tint));
		box-shadow:
			inset 0 0 0 1px rgba(255, 255, 255, 0.14),
			0 2px 6px rgba(0, 0, 0, 0.3);
	}
	.tile img {
		width: 60%;
		height: 60%;
		filter: none;
	}
</style>
