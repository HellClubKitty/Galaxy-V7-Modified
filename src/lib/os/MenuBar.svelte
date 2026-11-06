<script>
	import { onMount } from 'svelte';
	import { wm, find } from './wm.svelte.js';
	import { prefs } from './prefs.svelte.js';
	import { sp } from './spotify.svelte.js';
	import { extBar } from './extensions.svelte.js';
	import EqBars from './EqBars.svelte';
	import Logo from './Logo.svelte';

	let { onspotlight, oncontrol, controlOpen, onwindowaction, onsettings, onchangelog, onlock, onrestart, oncloseall, onspotify, spotifyOpen } = $props();

	let now = $state(new Date());
	onMount(() => {
		let timer;
		const tick = () => {
			now = new Date();
			timer = setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
		};
		tick();
		return () => clearTimeout(timer);
	});

	const date = $derived(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }));
	const time = $derived(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: !prefs.clock24 }));
	const active = $derived(wm.activeId ? find(wm.activeId) : null);
	let windowMenu = $state(false);
	let appleMenu = $state(false);
	const closeMenus = () => (windowMenu = appleMenu = false);
</script>

<svelte:window onpointerdown={closeMenus} />

<header class="bar noSelect" class:solid={prefs.menuBar === 'solid'} onpointerdown={(e) => e.stopPropagation()}>
	<div class="left">
		<div class="wm">
			<button class="item logo" class:on={appleMenu} onclick={(e) => (e.stopPropagation(), (windowMenu = false), (appleMenu = !appleMenu))} aria-label="Hopium menu">
				<Logo size={15} />
			</button>
			{#if appleMenu}
				<div class="drop" role="menu">
					<button role="menuitem" onclick={() => (closeMenus(), onchangelog())}>What’s new in Hopium</button>
					<hr />
					<button role="menuitem" onclick={() => (closeMenus(), onsettings())}>Settings…</button>
					<hr />
					<button role="menuitem" onclick={() => (closeMenus(), oncloseall())}>Close all windows</button>
					<button role="menuitem" onclick={() => (closeMenus(), onlock())}>Lock screen</button>
					<button role="menuitem" onclick={() => (closeMenus(), onrestart())}>Restart…</button>
				</div>
			{/if}
		</div>
		<span class="app">{active ? (active.title.replace(/ \(\d+\)$/, '')) : 'Hopium'}</span>
		{#if active}
			<div class="wm">
				<button class="item" class:on={windowMenu} onclick={(e) => (e.stopPropagation(), (appleMenu = false), (windowMenu = !windowMenu))}>Window</button>
				{#if windowMenu}
					<div class="drop" role="menu">
						<button role="menuitem" onclick={() => (onwindowaction('minimize'), (windowMenu = false))}>Minimize</button>
						<button role="menuitem" onclick={() => (onwindowaction('zoom'), (windowMenu = false))}>Zoom</button>
						<button role="menuitem" onclick={() => (onwindowaction('left'), (windowMenu = false))}>Tile left</button>
						<button role="menuitem" onclick={() => (onwindowaction('right'), (windowMenu = false))}>Tile right</button>
						<hr />
						<button role="menuitem" onclick={() => (onwindowaction('close'), (windowMenu = false))}>Close window</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<div class="right">
		{#each extBar.items as it (it.id)}
			<button class="item ext" class:on={it.active} onclick={it.onclick} aria-label={it.label || it.id}>
				{#if it.icon === 'timer'}
					<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="9" r="5" /><path d="M8 9V6.2M6.4 1.8h3.2" /></svg>
				{:else if it.icon === 'moon'}
					<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12.8 9.6A5.4 5.4 0 0 1 6.4 3.2a5.4 5.4 0 1 0 6.4 6.4z" /></svg>
				{/if}
				{#if it.label}<span class="t">{it.label}</span>{/if}
			</button>
		{/each}
		{#if prefs.spotifyHud && sp.connected && sp.track && sp.status !== 'idle'}
			<button class="item chip" class:on={spotifyOpen} onclick={onspotify} aria-label="Now playing: {sp.track.name}">
				<EqBars playing={sp.isPlaying} color="#1ed760" />
				<span class="t">{sp.track.name}</span>
			</button>
		{/if}
		<button class="item icon" onclick={onspotlight} aria-label="Search">
			<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" /><path d="M10.6 10.6 14 14" /></svg>
		</button>
		<button class="item icon" class:on={controlOpen} onclick={oncontrol} aria-label="Control Center">
			<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.8" y="3" width="12.4" height="3.6" rx="1.8" /><rect x="1.8" y="9.4" width="12.4" height="3.6" rx="1.8" /><circle cx="10.4" cy="4.8" r="1.1" class="fill" /><circle cx="5.6" cy="11.2" r="1.1" class="fill" /></svg>
		</button>
		<button class="item clock" onclick={oncontrol} aria-label="Date and time">
			{#if prefs.clockDate}<span>{date}</span>{/if}
			<span>{time}</span>
		</button>
	</div>
</header>

<style>
	.bar {
		position: absolute;
		inset: 0 0 auto 0;
		height: 28px;
		z-index: 9000;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 6px;
		font-size: 13px;
		font-weight: 500;
		color: #fff;
		background: linear-gradient(180deg, rgba(34, 34, 38, calc(var(--glass-a, 0.16) + 0.14)), rgba(20, 20, 24, calc(var(--glass-a, 0.16) + 0.08)));
		backdrop-filter: blur(var(--glass-blur, 28px)) saturate(1.9);
		box-shadow:
			0 0.5px 0 rgba(255, 255, 255, 0.14),
			0 4px 18px rgba(0, 0, 0, 0.16);
		text-shadow: 0 0 6px rgba(0, 0, 0, 0.25);
	}
	.bar.solid {
		background: #1c1c1e;
		backdrop-filter: none;
		text-shadow: none;
	}
	.left,
	.right {
		display: flex;
		align-items: center;
		gap: 2px;
		min-width: 0;
	}
	.item {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 22px;
		padding: 0 9px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		font: inherit;
		color: inherit;
	}
	.item:hover,
	.item.on {
		background: rgba(255, 255, 255, 0.16);
	}
	.logo svg,
	.icon svg {
		width: 15px;
		height: 15px;
		fill: currentColor;
		stroke: currentColor;
		stroke-width: 1.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.icon svg {
		fill: none;
	}
	.icon svg .fill {
		fill: currentColor;
	}
	.app {
		padding: 0 9px;
		font-weight: 700;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		max-width: 28vw;
	}
	.ext {
		gap: 6px;
		font-variant-numeric: tabular-nums;
	}
	.ext svg {
		width: 14px;
		height: 14px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.ext.on {
		color: var(--os-accent, #0a84ff);
		filter: brightness(1.35);
	}
	.chip {
		gap: 7px;
		max-width: 220px;
	}
	.chip .t {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 12.5px;
	}
	.clock {
		gap: 8px;
		font-variant-numeric: tabular-nums;
	}
	.wm {
		position: relative;
	}
	.drop {
		position: absolute;
		top: 26px;
		left: 0;
		min-width: 180px;
		padding: 5px;
		display: flex;
		flex-direction: column;
		border-radius: 12px;
		background: var(--glass-panel, rgba(40, 40, 44, 0.82));
		backdrop-filter: var(--glass-filter, blur(30px) saturate(1.8));
		box-shadow: var(--glass-edge, inset 0 0 0 0.5px rgba(255, 255, 255, 0.2)), var(--glass-drop, 0 10px 30px rgba(0, 0, 0, 0.4));
		text-shadow: none;
	}
	.drop button {
		height: 24px;
		padding: 0 10px;
		border: 0;
		border-radius: 5px;
		background: none;
		text-align: left;
		font-size: 13px;
		color: #fff;
	}
	.drop button:hover {
		background: var(--os-accent, #0a84ff);
	}
	.drop hr {
		width: 100%;
		margin: 4px 0;
		border: 0;
		border-top: 1px solid rgba(255, 255, 255, 0.14);
	}
	@media (max-width: 640px) {
		.wm,
		.chip .t,
		.clock span:first-child {
			display: none;
		}
	}
</style>
