<script>
	import { onMount, untrack } from 'svelte';
	import mainBG from '$lib/img/bg/default.webp';
	import earth from '$lib/img/icons/earthWhite.png';
	import changelogIcon from '$lib/img/icons/star.png';
	import { loadSetting, saveSetting, onSettingChange } from '$lib/utils/localspace.js';
	import { applyStartupSettings } from '$lib/utils/cloak.js';
	import { ADS_ENABLED } from '$lib/config.js';
	import { launchAds } from '$lib/utils/ads.js';
	import { baseApps } from '$lib/os/apps.js';
	import { wm, launch, openNew, closeApp, closeAll, minimizeAll, windowsOf, toast, syncViewport, find, focus, minimize, toggleMaximize, snap, close } from '$lib/os/wm.svelte.js';
	import { prefs, initPrefs } from '$lib/os/prefs.svelte.js';
	import MenuBar from '$lib/os/MenuBar.svelte';
	import Dock from '$lib/os/Dock.svelte';
	import Window from '$lib/os/Window.svelte';
	import AppIcon from '$lib/os/AppIcon.svelte';
	import Launchpad from '$lib/os/Launchpad.svelte';
	import ControlCenter from '$lib/os/ControlCenter.svelte';
	import LockScreen from '$lib/os/LockScreen.svelte';
	import AddApp from '$lib/os/AddApp.svelte';
	import BootScreen from '$lib/os/BootScreen.svelte';
	import Widgets from '$lib/os/Widgets.svelte';
	import SpotifyHUD from '$lib/os/SpotifyHUD.svelte';
	import Extensions from '$lib/os/Extensions.svelte';
	import { initExtensions } from '$lib/os/extensions.svelte.js';
	import { widgets, initWidgets, setShow, setEditing } from '$lib/os/widgets.svelte.js';
	import { initSpotify } from '$lib/os/spotify.svelte.js';
	import '$lib/style/os-glass.css';

	/** @typedef {import('$lib/os/apps.js').App} App */

	const unlockedBefore = () => {
		try {
			return sessionStorage.getItem('galaxy:unlocked') === '1';
		} catch {
			return false;
		}
	};

	let host = $state('');
	let bgURL = $state(mainBG);
	let customApps = $state(/** @type {App[]} */ ([]));
	let locked = $state(prefs.lockScreen && !unlockedBefore());
	let launchpadOpen = $state(false);
	let spotlightOpen = $state(false);
	let quickOpen = $state(false);
	let addOpen = $state(false);
	let menu = $state(/** @type {{ x: number, y: number, app: App | null } | null} */ (null));
	let fullscreen = $state(false);
	let spotifyOpen = $state(false);

	/* Startup screen. `bootVariant` stays null (plain black) until the saved setting is known. */
	let booting = $state(true);
	let bootVariant = $state(null);
	let bootKey = $state(0);
	let wallReady = $state(false);
	const resolveBoot = (style) => {
		if (style === 'mac' || style === 'windows') return style;
		const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
		return /win/i.test(platform) ? 'windows' : 'mac';
	};
	function whenWallpaperReady(url) {
		const img = new Image();
		img.onload = img.onerror = () => (wallReady = true);
		img.src = url;
	}

	const apps = $derived([...baseApps(), ...customApps]);
	const changelog = { id: 'changelog', name: 'What’s new', url: '/changelog', icon: changelogIcon, tint: '#5b6068', width: '46%', height: '66%' };

	function openApp(app) {
		if (!app) return;
		if (windowsOf(app.id).length === 0) {
			const note = new URLSearchParams(app.url.split('?')[1] ?? '').get('notif');
			if (note) toast(note);
			else {
				try {
					if (!localStorage.getItem('firstVisit')) {
						localStorage.setItem('firstVisit', 'false');
						toast('Right-click an app to open a new window');
					}
				} catch {}
			}
		}
		closeOverlays();
		return launch(app);
	}

	function closeOverlays() {
		launchpadOpen = spotlightOpen = quickOpen = spotifyOpen = false;
		menu = null;
	}

	function toggleSpotify() {
		const next = !spotifyOpen;
		closeOverlays();
		spotifyOpen = next;
	}

	/* Open Settings on a given tab, re-using the Settings window if there already is one. */
	function openSettings(tab) {
		const app = apps.find((a) => a.id === 'settings');
		const url = `/settings?tab=${tab}`;
		closeOverlays();
		const existing = windowsOf('settings')[0];
		if (existing) {
			existing.url = url;
			focus(existing.id);
		} else launch({ ...app, url });
	}

	function unlock() {
		locked = false;
		try {
			sessionStorage.setItem('galaxy:unlocked', '1');
		} catch {}
	}
	function lock() {
		try {
			sessionStorage.removeItem('galaxy:unlocked');
		} catch {}
		closeOverlays();
		locked = true;
	}

	async function addApp(data) {
		const params = new URLSearchParams({ url: data.url, type: data.proxy, transport: data.transport });
		if (data.notif) params.set('notif', data.notif);
		if (data.wisp) params.set('wisp', data.wisp);
		let iconUrl = data.icon;
		if (!iconUrl) {
			try {
				const { default: faviconFetch } = await import('favicon-fetch');
				const hostname = new URL(/^https?:\/\//i.test(data.url) ? data.url : `https://${data.url}`).hostname;
				iconUrl = faviconFetch({ hostname });
			} catch {
				iconUrl = earth;
			}
		}
		customApps.push({
			id: `custom-${Date.now()}`,
			url: `/api?${params}`,
			name: data.name,
			icon: iconUrl,
			width: '62%',
			height: '70%'
		});
		saveSetting('customApps', $state.snapshot(customApps));
		addOpen = false;
	}

	function removeApp(app) {
		closeApp(app.id);
		customApps = customApps.filter((a) => a.id !== app.id);
		saveSetting('customApps', $state.snapshot(customApps));
	}

	function openMenu(e, app) {
		e.preventDefault();
		e.stopPropagation();
		launchpadOpen = spotlightOpen = quickOpen = spotifyOpen = false;
		menu = { x: Math.min(e.clientX, innerWidth - 180), y: Math.min(e.clientY, innerHeight - 170), app };
	}

	function searchWeb(q) {
		closeOverlays();
		openNew({ ...apps[0], url: `/slate?q=${encodeURIComponent(q)}` });
	}

	function toggleFullscreen() {
		if (document.fullscreenElement) document.exitFullscreen();
		else document.documentElement.requestFullscreen?.();
	}

	function showDesktop() {
		closeOverlays();
		minimizeAll();
	}

	/* Cmd/Ctrl+Space opens Spotlight; tapping Cmd/Win alone opens Launchpad. */
	let metaAlone = false;
	function keydown(e) {
		if (locked) return;
		metaAlone = e.key === 'Meta';
		if (e.key === 'Escape') closeOverlays();
		if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
			e.preventDefault();
			const next = !spotlightOpen;
			closeOverlays();
			spotlightOpen = next;
		}
	}
	function keyup(e) {
		if (!locked && e.key === 'Meta' && metaAlone) {
			const next = !launchpadOpen;
			closeOverlays();
			launchpadOpen = next;
		}
		metaAlone = false;
	}

	function windowAction(kind) {
		const win = wm.activeId ? find(wm.activeId) : null;
		if (!win) return;
		if (kind === 'minimize') minimize(win.id);
		else if (kind === 'zoom') toggleMaximize(win.id);
		else if (kind === 'left' || kind === 'right') snap(win.id, kind);
		else if (kind === 'close') close(win.id);
	}

	// Keep window geometry in step with the menu bar and dock.
	$effect(() => {
		const dock = prefs.dockAutoHide ? 0 : prefs.dockSize + 22;
		wm.inset.top = 28;
		wm.inset.bottom = prefs.dockPos === 'bottom' ? dock : 0;
		wm.inset.left = prefs.dockPos === 'left' ? dock : 0;
		wm.inset.right = prefs.dockPos === 'right' ? dock : 0;
		untrack(syncViewport);
	});

	onMount(() => {
		const stopPrefs = initPrefs();
		const stopWidgets = initWidgets();
		const stopExt = initExtensions();
		const stopSpotify = initSpotify();
		applyStartupSettings();
		host = location.hostname === 'localhost' ? 'v7.galxy.it.com' : location.hostname;
		syncViewport();
		if (ADS_ENABLED) document.addEventListener('pointerdown', launchAds);

		const offs = [
			onSettingChange('bg', (v) => (bgURL = v ?? mainBG)),
			onSettingChange('customApps', (v) => (customApps = v ?? [])),
			onSettingChange('widgetsEdit', () => (closeOverlays(), setEditing(true))),
			// "Preview" buttons in Settings play the startup screen on the real desktop.
			onSettingChange('bootPreview', (v) => {
				if (!v?.style) return;
				wallReady = true;
				bootVariant = resolveBoot(v.style);
				bootKey++;
				booting = true;
			})
		];
		const fs = () => (fullscreen = !!document.fullscreenElement);
		document.addEventListener('fullscreenchange', fs);

		loadSetting('desktop', null)
			.catch(() => null)
			.then((d) => {
				if (d && d.lockScreen === false) locked = false;
				const style = d?.bootStyle ?? 'auto';
				if (style === 'off') booting = false;
				else bootVariant = resolveBoot(style);
			});
		// Never hold the boot screen for more than a few seconds, even if the image stalls.
		setTimeout(() => (wallReady = true), 5000);
		Promise.all([loadSetting('bg', mainBG), loadSetting('customApps', [])])
			.then(([bg, saved]) => {
				bgURL = bg;
				customApps = saved;
				whenWallpaperReady(bg);
			})
			.catch(() => (wallReady = true))
			.catch(() => {});

		return () => {
			stopPrefs();
			stopWidgets();
			stopExt();
			stopSpotify();
			offs.forEach((off) => off());
			document.removeEventListener('fullscreenchange', fs);
			document.removeEventListener('pointerdown', launchAds);
		};
	});
</script>

<svelte:head><title>Hopium</title></svelte:head>
<svelte:window onresize={syncViewport} onkeydown={keydown} onkeyup={keyup} onblur={closeOverlays} />

<div
	class="desktop noSelect"
	class:dragging={wm.dragging}
	class:noanim={!prefs.animations}
	style:--it="{wm.inset.top}px"
	style:--ib="{wm.inset.bottom}px"
	style:--il="{wm.inset.left}px"
	style:--ir="{wm.inset.right}px"
	style:--os-accent={prefs.accent}
	style:--glass-blur="{prefs.glassBlur}px"
	style:--glass-a={prefs.glassStrength}
	onpointerdown={closeOverlays}
	oncontextmenu={(e) => openMenu(e, null)}
	role="presentation"
>
	<div class="wallpaper" class:drift={prefs.wallpaperFx && prefs.animations} style:background-image="url({bgURL})"></div>
	{#if prefs.wallpaperFx}<div class="wallpaper-fx"></div>{/if}

	{#if prefs.desktopIcons}
		<div class="icons">
			{#each apps as app (app.id)}
				<button class="icon" onpointerdown={(e) => e.stopPropagation()} onclick={() => openApp(app)} oncontextmenu={(e) => openMenu(e, app)}>
					<AppIcon {app} size={52} />
					<span>{app.name}</span>
				</button>
			{/each}
		</div>
	{/if}

	<Extensions {apps} onopenapp={openApp} />

	<Widgets onspotify={() => openSettings('spotify')} />

	{#each wm.windows as win (win.id)}
		<Window {win} />
	{/each}

	{#if wm.snapPreview}
		<div class="snap {wm.snapPreview}"></div>
	{/if}

	<MenuBar
		controlOpen={quickOpen}
		{spotifyOpen}
		onspotify={toggleSpotify}
		onspotlight={() => {
			const next = !spotlightOpen;
			closeOverlays();
			spotlightOpen = next;
		}}
		oncontrol={() => {
			const next = !quickOpen;
			closeOverlays();
			quickOpen = next;
		}}
		onwindowaction={windowAction}
		onsettings={() => openApp(apps.find((a) => a.id === 'settings'))}
		onchangelog={() => openApp(changelog)}
		onlock={lock}
		onrestart={() => {
			// A restart should go back through the lock screen as well.
			try {
				sessionStorage.removeItem('galaxy:unlocked');
			} catch {}
			location.reload();
		}}
		oncloseall={closeAll}
	/>

	<Dock
		{apps}
		{launchpadOpen}
		onlaunch={openApp}
		oncontext={openMenu}
		onlaunchpad={() => {
			const next = !launchpadOpen;
			closeOverlays();
			launchpadOpen = next;
		}}
	/>

	{#if quickOpen}
		<ControlCenter
			isFullscreen={fullscreen}
			onspotify={toggleSpotify}
			hasWindows={wm.windows.length > 0}
			onfullscreen={toggleFullscreen}
			onshowdesktop={showDesktop}
			onsettings={() => openApp(apps.find((a) => a.id === 'settings'))}
			onchangelog={() => openApp(changelog)}
			onlock={lock}
			onclosewindows={() => {
				closeAll();
				quickOpen = false;
			}}
		/>
	{/if}

	<SpotifyHUD open={spotifyOpen} onopen={toggleSpotify} onclose={() => (spotifyOpen = false)} onsettings={() => openSettings('spotify')} />

	{#if launchpadOpen}
		<Launchpad mode="launchpad" {apps} onlaunch={openApp} onsearch={searchWeb} onadd={() => ((launchpadOpen = false), (addOpen = true))} onclose={closeOverlays} />
	{/if}
	{#if spotlightOpen}
		<Launchpad mode="spotlight" {apps} onlaunch={openApp} onsearch={searchWeb} onclose={closeOverlays} />
	{/if}

	{#if menu}
		{@const contextMenu = menu}
		<div class="menu" style:left="{contextMenu.x}px" style:top="{contextMenu.y}px" onpointerdown={(e) => e.stopPropagation()} role="menu" tabindex="-1">
			{#if contextMenu.app}
				{@const contextApp = contextMenu.app}
				<button role="menuitem" onclick={() => (openNew(contextApp), (menu = null))}>New window</button>
				{#if windowsOf(contextApp.id).length}
					<button role="menuitem" onclick={() => (closeApp(contextApp.id), (menu = null))}>Close windows</button>
				{/if}
				{#if contextApp.id.startsWith('custom-')}
					<button role="menuitem" class="danger" onclick={() => (removeApp(contextApp), (menu = null))}>Remove app</button>
				{/if}
			{:else}
				<button role="menuitem" onclick={() => ((addOpen = true), (menu = null))}>Add app…</button>
				<button role="menuitem" onclick={() => (setEditing(true), (menu = null))}>Edit widgets…</button>
				<button role="menuitem" onclick={() => (setShow(!widgets.show), (menu = null))}>{widgets.show ? 'Hide widgets' : 'Show widgets'}</button>
				<button role="menuitem" onclick={() => (openApp(apps.find((a) => a.id === 'settings')), (menu = null))}>Change wallpaper &amp; dock…</button>
			{/if}
		</div>
	{/if}

	{#if addOpen}<AddApp onadd={addApp} onclose={() => (addOpen = false)} />{/if}

	<div class="toasts" aria-live="polite">
		{#each wm.toasts as t (t.id)}
			<div class="toast">{t.message}</div>
		{/each}
	</div>

	{#if locked}<LockScreen bg={bgURL} paused={booting} onunlock={unlock} />{/if}

	{#if booting}
		{#key bootKey}
			<BootScreen variant={bootVariant} ready={wallReady} ondone={() => (booting = false)} />
		{/key}
	{/if}
</div>

<style>
	:global(html, body) {
		height: 100%;
		overflow: hidden;
		background: #000;
	}
	.desktop {
		position: fixed;
		inset: 0;
		overflow: hidden;
		background: #000;
	}
	.wallpaper {
		position: absolute;
		inset: 0;
		background-size: cover;
		background-position: center;
	}
	/* a very slow drift so the desktop never looks frozen */
	.wallpaper.drift {
		animation: drift 70s ease-in-out infinite alternate;
	}
	@keyframes drift {
		from {
			transform: scale(1.02) translate3d(-0.6%, -0.4%, 0);
		}
		to {
			transform: scale(1.07) translate3d(0.6%, 0.5%, 0);
		}
	}
	.icons {
		position: absolute;
		top: calc(var(--it) + 10px);
		right: calc(var(--ir) + 10px);
		bottom: calc(var(--ib) + 10px);
		left: calc(var(--il) + 10px);
		display: flex;
		flex-flow: column wrap-reverse;
		align-content: flex-start;
		gap: 6px;
		pointer-events: none;
	}
	.icon {
		pointer-events: auto;
		width: 88px;
		padding: 8px 4px 6px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: transparent;
		font-size: 12px;
		color: #fff;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
	}
	.icon:hover {
		background: rgba(255, 255, 255, 0.12);
		border-color: rgba(255, 255, 255, 0.16);
	}
	.icon span {
		max-width: 100%;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.snap {
		position: absolute;
		top: var(--it);
		bottom: var(--ib);
		z-index: 7000;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.16);
		border: 1.5px solid rgba(255, 255, 255, 0.4);
		pointer-events: none;
		animation: fade 120ms;
	}
	.snap.left {
		left: calc(var(--il) + 6px);
		width: calc(50% - 9px);
	}
	.snap.right {
		right: calc(var(--ir) + 6px);
		width: calc(50% - 9px);
	}
	.snap.top {
		left: calc(var(--il) + 6px);
		right: calc(var(--ir) + 6px);
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	.noanim :global(*) {
		animation-duration: 0.01ms !important;
		transition-duration: 0.01ms !important;
	}
	.menu {
		position: absolute;
		z-index: 9600;
		min-width: 168px;
		padding: 4px;
		display: flex;
		flex-direction: column;
		border-radius: 12px;
		background: var(--glass-panel);
		backdrop-filter: var(--glass-filter);
		box-shadow: var(--glass-edge), var(--glass-drop);
		animation: fade 100ms;
	}
	.menu button {
		height: 32px;
		padding: 0 12px;
		border: 0;
		border-radius: 5px;
		background: none;
		text-align: left;
		font-size: 13px;
	}
	.menu button {
		color: #fff;
	}
	.menu button:hover {
		background: var(--os-accent);
	}
	.menu .danger {
		color: var(--color-danger);
	}
	.toasts {
		position: absolute;
		top: 40px;
		left: 50%;
		translate: -50% 0;
		z-index: 9900;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		pointer-events: none;
	}
	.toast {
		padding: 10px 18px;
		border-radius: 999px;
		background: var(--glass-panel);
		backdrop-filter: var(--glass-filter);
		box-shadow: var(--glass-edge), 0 10px 28px rgba(0, 0, 0, 0.3);
		color: #fff;
		font-size: 13px;
		animation: toast 3s var(--ease-out) both;
	}
	@keyframes toast {
		0% {
			opacity: 0;
			translate: 0 -12px;
		}
		8%,
		88% {
			opacity: 1;
			translate: 0;
		}
		100% {
			opacity: 0;
			translate: 0 -6px;
		}
	}
</style>
