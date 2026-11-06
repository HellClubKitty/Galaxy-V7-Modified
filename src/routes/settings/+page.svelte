<script>
	import '$lib/style/settings.css';
	import Pref from '$lib/utils/settings/pref.svelte';
	import Themes from '$lib/utils/settings/themes.svelte';
	import Pro from '$lib/utils/settings/pro.svelte';
	import Os from '$lib/utils/settings/os.svelte';
	import Desktop from '$lib/utils/settings/desktop.svelte';
	import Spotify from '$lib/utils/settings/spotify.svelte';
	import Extensions from '$lib/utils/settings/extensions.svelte';
	import { browser } from '$app/environment';
	import Data from '$lib/utils/settings/data.svelte';
	import Cloak from '$lib/utils/Cloak.svelte';

	const sections = [
		{ id: 'pref', name: 'Preferences', hue: '#8e8e93', icon: 'M3 5h10M3 11h10M6 3v4M10 9v4', comp: Pref },
		{ id: 'desktop', name: 'Desktop & Dock', hue: '#5e5ce6', icon: 'M2.5 3.5h11v7h-11zM5 13h6M4 10.5h8', comp: Desktop },
		{ id: 'spotify', name: 'Spotify', hue: '#1db954', icon: 'M2.6 5.6c3.5-1.1 7.6-.8 10.8 1M3.2 8.4c3-.9 6.4-.6 9.2.9M3.8 11c2.5-.6 5-.4 7.2.8', comp: Spotify },
		{ id: 'extensions', name: 'Extensions', hue: '#ff375f', icon: 'M6.2 3.3a1.4 1.4 0 0 1 2.8 0V4.4h2.9v2.8h-1.1a1.4 1.4 0 1 0 0 2.8h1.1v2.9H9v-1.1a1.4 1.4 0 1 0-2.8 0v1.1H3.3V10h1.1a1.4 1.4 0 1 0 0-2.8H3.3V4.4h2.9z', comp: Extensions },
		{ id: 'pro', name: 'Proxy', hue: '#0a84ff', icon: 'M8 1.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 8 1.8zM1.8 8h12.4M8 1.8c2 2 2 10.4 0 12.4M8 1.8c-2 2-2 10.4 0 12.4', comp: Pro },
		{ id: 'themes', name: 'Themes', hue: '#bf5af2', icon: 'M8 2a6 6 0 1 0 0 12c1 0 1.5-.8 1.1-1.7-.4-.8.1-1.6 1-1.6H11a3 3 0 0 0 3-3A6 6 0 0 0 8 2z', comp: Themes },
		{ id: 'os', name: 'Background', hue: '#30b0c7', icon: 'M2.5 3.5h11v9h-11zM2.5 11l3.2-3.2 2.3 2.3 2-2 3.5 3.4', comp: Os },
		{ id: 'data', name: 'Data', hue: '#34c759', icon: 'M3 4.5C3 3.4 5.2 2.5 8 2.5s5 .9 5 2-2.2 2-5 2-5-.9-5-2zM3 4.5v7c0 1.1 2.2 2 5 2s5-.9 5-2v-7M3 8c0 1.1 2.2 2 5 2s5-.9 5-2', comp: Data }
	];

	const wanted = browser ? new URLSearchParams(location.search).get('tab') : null;
	let current = $state(sections.some((s) => s.id === wanted) ? wanted : sections[0].id);
	const active = $derived(sections.find((s) => s.id === current) ?? sections[0]);
</script>

<svelte:head><title>Settings</title></svelte:head>

<div class="shell">
	<nav class="side noSelect" aria-label="Settings sections">
		{#each sections as s (s.id)}
			<button class="item" class:on={current === s.id} onclick={() => (current = s.id)} aria-current={current === s.id}>
				<span class="ico" style:background={s.hue}>
					<svg viewBox="0 0 16 16" aria-hidden="true"><path d={s.icon} /></svg>
				</span>
				<span><Cloak text={s.name} /></span>
			</button>
		{/each}
	</nav>

	<main class="pane">
		<h1 class="title"><Cloak text={active.name} /></h1>
		{#key current}
			<div class="section"><active.comp /></div>
		{/key}
	</main>
</div>

<style>
	:global(html, body) {
		height: 100%;
		overflow: hidden;
	}
	.shell {
		display: grid;
		grid-template-columns: 220px 1fr;
		height: 100vh;
		background: var(--color-bg);
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 16px 10px;
		overflow: auto;
		background: var(--color-surface);
		border-right: 1px solid var(--color-border);
	}
	.item {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 38px;
		padding: 0 10px;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-text-muted);
		font-size: 13.5px;
		font-weight: 500;
		text-align: left;
		transition: background var(--dur-fast);
	}
	.item:hover {
		background: var(--overlay-hover);
		color: var(--color-text);
	}
	.item.on {
		background: var(--overlay-hover-strong);
		color: var(--color-text);
	}
	.ico {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: 7px;
		flex: none;
	}
	.ico svg {
		width: 14px;
		height: 14px;
		fill: none;
		stroke: #fff;
		stroke-width: 1.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.pane {
		min-width: 0;
		overflow-y: auto;
		padding: 28px 36px 48px;
	}
	.title {
		max-width: 860px;
		margin: 0 auto 18px;
		font-size: 26px;
	}
	.section {
		max-width: 860px;
		margin: 0 auto;
		animation: in 220ms var(--ease-out);
	}
	@keyframes in {
		from {
			opacity: 0;
			translate: 0 8px;
		}
	}
	@media (max-width: 640px) {
		.shell {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
		}
		.side {
			flex-direction: row;
			border-right: 0;
			border-bottom: 1px solid var(--color-border);
			padding: 8px;
		}
		.item {
			flex: none;
		}
		.pane {
			padding: 20px 16px 40px;
		}
	}
</style>
