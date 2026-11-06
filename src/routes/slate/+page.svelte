<script>
	import '$lib/style/browser.css';
	import Tab from '$lib/utils/browser/tab.svelte';
	import Iframe from '$lib/utils/browser/iframe.svelte';
	import Home from '$lib/utils/browser/home.svelte';
	import { loadSetting, saveSetting, onSettingChange } from '$lib/utils/localspace.js';
	import {
		deleteTab,
		activeTab,
		reloadSignal,
		goBackSignal,
		goForwardSignal,
		slotsDragged,
		draggedOverLeft,
		draggedOverRight,
		isTabDragging
	} from '$lib/stores/index.js';
	import { onMount, tick } from 'svelte';
	import { ext, extList, isOn, toggleExt, initExtensions } from '$lib/os/extensions.svelte.js';
	import { loadScript, loadScriptsSequential } from '$lib/lethe/loader';
	import { search } from '$lib/lethe/search';
	import { createConnection, setCar, getWispUrl } from '$lib/lethe/car';
	import { createScramjetController } from '$lib/lethe/poly';
	import { initScramjet, ensureProxyServiceWorker } from '$lib/lethe/service-worker.js';
	import { toast } from '$lib/os/wm.svelte.js';
	import { createPrismController, setPrismTransport, getPrismController, preferredPrismTransport } from '$lib/lethe/prism';
	import { hasCharacterAiFrame } from '$lib/lethe/transport-selection.js';
	import { enablePopupInterceptor } from '$lib/lethe/reflux';
	
	// Follow the desktop's accent colour, and share the extension list with the desktop.
	onMount(() => {
		const stopExt = initExtensions();
		const set = (d) => d?.accent && document.documentElement.style.setProperty('--accent', d.accent);
		loadSetting('desktop', null).then(set).catch(() => {});
		const off = onSettingChange('desktop', set);
		return () => (off(), stopExt());
	});

	let tabs = $state([]);
	let frames = $state([]);
	let query = $state('');
	let inputEl;
	let inputFocused = $state(false);
	let hydrated = $state(false);
	let letheEngine = $state('sj2');
	let ready = $state(false);
	let polygon;
	let prismController;
	let sjFrame;
	let customWisp = $state('');
	let defaultWispUrl = $state('');
	let activeWispUrl = $derived(customWisp || defaultWispUrl || 'Loading default server…');
	let searchEngine = $state('ddg');
	let car = $state('libcurl');
	let bookmarks = $state([]);
	let connection;
	let activeFrame = $derived(frames.find((frame) => frame.id === $activeTab));
	let browserExtensions = $derived(ext.user.filter((extension) => isOn(extension.id) && extension.contentScripts?.length));
	let draggedTab = null;
	let LastPopupIntState = $state(true);

	$effect(() => {
		if ($deleteTab) {
			tabs = tabs.filter((tab) => tab.id !== $deleteTab);
			frames = frames.filter((frame) => frame.id !== $deleteTab);
			if ($deleteTab == $activeTab && tabs.length > 0) $activeTab = tabs[tabs.length - 1].id;
			$deleteTab = null;
			if (tabs.length === 0) addTab();
		}
	});

	function addTab() {
		const id = Date.now();
		tabs.push({ id });
		frames.push({ id, url: null, displayUrl: '', transportUrl: '', title: 'New Tab' });
		$activeTab = id;
	}
	onMount(async () => {
		LastPopupIntState = popupInterceptor;
		defaultWispUrl = getWispUrl();
		addTab();

		// hydrate saved settings
		const [lethe, savedCar, wisp, engine, marks, intercept, LastPopupIntStateX] = await Promise.all(
			[
				loadSetting('lethe', 'sj2'),
				loadSetting('car', 'libcurl'),
				loadSetting('customWisp', ''),
				loadSetting('searchEngine', 'ddg'),
				loadSetting('bookmarks', [], JSON.parse),
				loadSetting('popupInterceptor', true, (raw) => raw === 'true'),
				loadSetting('LastPopupIntState', true)
			]
		);
		letheEngine = lethe;
		car = savedCar;
		customWisp = wisp;
		searchEngine = engine;
		bookmarks = marks;
		LastPopupIntState = LastPopupIntStateX;
		popupInterceptor = LastPopupIntState; //intercept
		hydrated = true;

		// Rendered inside the settings theme preview: show the chrome, skip the proxy stack
		// so opening /settings doesn't load the transports or open a wisp connection.
		if (new URLSearchParams(location.search).has('preview')) {
			ready = true;
			return;
		}

		await loadScriptsSequential([
			'/charon/index.js',
			'/glass/glass.bundle.js',
			'/glass/glass.config.js',
			'/poly/polygon.all.js'
		]);
		polygon = createScramjetController();
		connection = createConnection();
		await setCar(connection, car, customWisp);
		await enablePopupInterceptor();
		ready = true;
		const q = new URLSearchParams(location.search).get('q');
		if (q) navigateTo(q);
	});

	onMount(() => {
		const offs = [
			onSettingChange('lethe', (v) => (letheEngine = v)),
			onSettingChange('car', (v) => (car = v)),
			onSettingChange('customWisp', (v) => (customWisp = v)),
			onSettingChange('searchEngine', (v) => (searchEngine = v))
		];
		return () => offs.forEach((off) => off());
	});

	async function ensurePrism(transport = car) {
		if (sjFrame) {
			await setPrismTransport(transport, customWisp || undefined);
			return sjFrame;
		}
		prismController = await createPrismController(transport, customWisp || undefined);
		sjFrame = prismController.createFrame();
		return sjFrame;
	}
	function prismEncode(fixedUrl) {
		// @ts-ignore
		return window.$scramjet.rewriteUrl(fixedUrl, sjFrame.context, {
			origin: new URL(location.href),
			base: new URL(location.href)
		});
	}

	async function navigateTo(rawQuery) {
		if (!ready || !activeFrame || !rawQuery?.trim()) return;
		try {
			const fixedUrl = search(rawQuery, searchEngine);
			// Select the destination's transport before the iframe loads. Waiting for its
			// onload event is too late for sites that open WebSockets during startup.
			activeFrame.transportUrl = fixedUrl;
			let encoded;
			if (letheEngine === 'sj2') {
				const transport = preferredPrismTransport(fixedUrl, car);
				await ensurePrism(transport);
				encoded = prismEncode(fixedUrl);
			} else if (letheEngine === 'uv') {
				await ensureProxyServiceWorker();
				// @ts-ignore
				encoded = window.__uv$config.prefix + window.__uv$config.encodeUrl(fixedUrl);
			} else {
				await initScramjet(polygon);
				encoded = polygon.encodeUrl(fixedUrl);
			}
			activeFrame.url = encoded;
			if (rawQuery.includes('discord')) {
				LastPopupIntState = popupInterceptor;
				popupInterceptor = false;
			}
			if (!rawQuery.includes('discord')) popupInterceptor = LastPopupIntState;
		} catch (error) {
			console.error('Proxy navigation failed:', error);
			toast(`Proxy error: ${error instanceof Error ? error.message : String(error)}`, 5000);
		}
	}


	let lastOpenedUrl = '';
	let lastOpenedTime = 0;
	async function openInNewTab(targetUrl) {
		if (!targetUrl || !popupInterceptor) {
			return;
		}
		const currentTime = Date.now();
		const timeSinceLastOpen = currentTime - lastOpenedTime;
		const isSameUrl = targetUrl === lastOpenedUrl;
		if (isSameUrl && timeSinceLastOpen < 800) {
			return;
		}
		lastOpenedUrl = targetUrl;
		lastOpenedTime = currentTime;
		addTab();
		await tick();
		navigateTo(targetUrl);
	}

	async function handleSubmit(e) {
		e.preventDefault();
		navigateTo(query);
		inputEl?.blur();
	}
	let bookmarkMenu = $state(false);
	let activeFrameURL = $state();
	let activeFrameTitle = $state();
	let activeFrameEngine = $state();

	function startBookmark() {
		settingsOpen = false;
		activeFrameURL = activeFrame.displayUrl;
		activeFrameTitle = activeFrame.title;
		activeFrameEngine = letheEngine;
		bookmarkMenu = true;
	}
	function toggleBookmarks() {
		bookmarkMenu = !bookmarkMenu;
	}
	function addBookmark() {
		if (!activeFrame?.displayUrl) return;
		bookmarks.push({ url: activeFrameURL, title: activeFrameTitle, lethe: activeFrameEngine });
		bookmarkMenu = false;
	}
	function removeBookmark(index) {
		bookmarks.splice(index, 1);
	}
	async function bookmarkSearch(url, lethe) {
		let encoded;
		activeFrame.transportUrl = url;
		if (lethe === 'sj2') {
			await ensurePrism(preferredPrismTransport(url, car));
			encoded = prismEncode(url);
		} else if (lethe === 'uv') {
			// @ts-ignore
			encoded = window.__uv$config.prefix + window.__uv$config.encodeUrl(url);
		} else {
			encoded = polygon.encodeUrl(url);
		}
		activeFrame.url = encoded;
		inputEl?.blur();
	}

	function handleNavigate(id, { url, title }) {
		const frame = frames.find((frame) => frame.id === id);
		if (!frame) {
			return;
		}
		frame.displayUrl = url;
		frame.transportUrl = url;
		frame.title = title;
	}
	$effect(() => {
		const current = activeFrame?.displayUrl ?? '';
		if (!inputFocused) query = current;
	});
	$effect(() => {
		if (!$isTabDragging) {
			$draggedOverLeft = $draggedOverRight = null;
			return;
		}
		const from = tabs.findIndex((tab) => tab.id === $activeTab);
		const to = Math.min(Math.max(from + ($slotsDragged ?? 0), 0), tabs.length - 1);
		$draggedOverLeft = to > from ? tabs[to].id : null;
		$draggedOverRight = to < from ? tabs[to].id : null;
	});

	function moveTab(id) {
		const from = tabs.findIndex((tab) => tab.id === id);
		if (from === -1) return;
		const temp = tabs.splice(from, 1)[0];
		const newIndex = Math.max(0, Math.min(from + ($slotsDragged ?? 0), tabs.length));
		tabs.splice(newIndex, 0, temp);
		$slotsDragged = null;
		$draggedOverLeft = null;
		$draggedOverRight = null;
	}
	$effect(() => {
		if (ready && connection) {
			setCar(connection, car, customWisp);
		}
		if (getPrismController()) {
			// One Prism controller is shared by all tabs. Keep Epoxy active while any
			// Character.AI tab exists, including when that tab is in the background.
			const characterAiOpen = hasCharacterAiFrame(frames);
			setPrismTransport(characterAiOpen ? 'epoxy' : car, customWisp || undefined);
		}
	});
	function goBack() {
		$goBackSignal = $activeTab;
	}
	function goForward() {
		$goForwardSignal = $activeTab;
	}

	function reloadTab() {
		$reloadSignal = $activeTab;
	}

	let settingsOpen = $state(false);
	let extensionsOpen = $state(false);
	let popupInterceptor = $state(true); // hydrated from localspace in onMount
	function toggleSettings() {
		settingsOpen = !settingsOpen;
		if (settingsOpen) {
			bookmarkMenu = false;
			extensionsOpen = false;
		}
	}
	function closeSettings() {
		settingsOpen = false;
	}
	function toggleExtensions() {
		extensionsOpen = !extensionsOpen;
	}
	function togglePopupInterceptor() {
		popupInterceptor = !popupInterceptor;
	}
	function openInNewWindow() {
		if (!activeFrame || !activeFrame.url) {
			return;
		}
		window.open(activeFrame.url, '_blank', 'noopener');
		closeSettings();
	}

	async function openInspector() {
		closeSettings();
		try {
			await loadScript('https://cdn.jsdelivr.net/npm/eruda');
			window.eruda?.init();
			window.eruda?.show();
		} catch (e) {
			console.error('Failed to load inspector:', e);
		}
	}

	function toggleFullscreen() {
		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			const iframes = document.querySelectorAll('.frameContainer iframe');
			const activeIframe = Array.from(iframes).find((el) => el.offsetParent !== null);
			if (activeIframe) {
				activeIframe.requestFullscreen();
			}
		}
		closeSettings();
	}

	$effect(() => {
		if (!hydrated) return;
		saveSetting('lethe', letheEngine);
		saveSetting('car', car);
		saveSetting('customWisp', customWisp);
		saveSetting('searchEngine', searchEngine);
		saveSetting('bookmarks', $state.snapshot(bookmarks));
		saveSetting('popupInterceptor', popupInterceptor);
		saveSetting('LastPopupIntState', LastPopupIntState);
	});
</script>

<div class="tab-bar noSelect">
	{#each tabs as tab (tab.id)}
		{@const frame = frames.find((frame) => frame.id === tab.id)}
		<Tab id={tab.id} title={frame.title} displayUrl={frame?.displayUrl ?? ''} onDrop={moveTab} />
	{/each}
	<button type="button" class="newTab noSelect" onclick={addTab} aria-label="New tab"><svg class="plus" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2.6v8.8M2.6 7h8.8" /></svg></button>
</div>
<div class="nav-bar noSelect">
	<div class="nav-left">
		<button type="button" class="button" onclick={goBack}><svg class="ni" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5" /></svg></button>
		<button type="button" class="button" onclick={goForward}><svg class="ni" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" /></svg></button>
		<button type="button" class="button" onclick={reloadTab}><svg class="ni" viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.7-3.8M13 2.6v2.8h-2.8" /></svg></button>
	</div>
	<div class="nav-middle">
		<form onsubmit={handleSubmit}>
			<svg class="searchIcon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.4" /><path d="M10.4 10.4L13.6 13.6" /></svg>
			<input
				type="text"
				class="search-input search"
				placeholder="Search or enter address"
				bind:value={query}
				bind:this={inputEl}
				onfocus={() => {
					inputFocused = true;
					inputEl?.select();
				}}
				onblur={() => (inputFocused = false)}
				autocomplete="off"
				spellcheck="false"
				disabled={!ready}
			/>
			<button type="button" class="star" onclick={startBookmark} aria-label="Bookmark this page"><svg class="starIcon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.2l1.7 3.5 3.8.5-2.8 2.7.7 3.8L8 10.9l-3.4 1.8.7-3.8L2.5 6.2l3.8-.5z" /></svg></button>
		</form>
		{#if bookmarkMenu}
			<div class="settings-overlay" onclick={toggleBookmarks} role="presentation"></div>

			<div class="bookmarkContainer">
				<p class="bookmarkTitle">Add bookmark</p>
				<span class="bookmarkLabel">Name</span>
				<input class="bookmark-input" bind:value={activeFrameTitle} />
				<span class="bookmarkLabel">URL</span>
				<input class="bookmark-input" bind:value={activeFrameURL} />
				<div class="flex">
					<p class="randomthing">Right click a bookmark to remove</p>
					<button class="bookmarkDone" onclick={addBookmark}>Done</button>
				</div>
			</div>
		{/if}
	</div>

	<div class="nav-right">
		<button type="button" class="button" onclick={toggleExtensions}><svg class="ni" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.2 3.3a1.4 1.4 0 0 1 2.8 0V4.4h2.9v2.8h-1.1a1.4 1.4 0 1 0 0 2.8h1.1v2.9H9v-1.1a1.4 1.4 0 1 0-2.8 0v1.1H3.3V10h1.1a1.4 1.4 0 1 0 0-2.8H3.3V4.4h2.9z" /></svg></button>
		{#if extensionsOpen}
			<div class="settings-overlay" onclick={toggleExtensions} role="presentation"></div>
			<div class="extensionContainer">
				<div class="extensionBlock">
					<div class="aboutExtension">
						<p class="extensionName">Popup Interceptor</p>
						<p class="extensionDesc">
							Intercepts popup requests and opens them in Hopium instead of the native browser.
						</p>
					</div>
					<button
						type="button"
						class="extensionToggle"
						class:on={popupInterceptor}
						role="switch"
						aria-checked={popupInterceptor}
						aria-label="Toggle Popup Interceptor"
						onclick={togglePopupInterceptor}
					>
						<span class="toggleKnob"></span>
					</button>
				</div>
				{#each extList() as e (e.id)}
					<div class="extensionBlock">
						<div class="aboutExtension">
							<p class="extensionName">{e.name}</p>
							<p class="extensionDesc">{e.description}</p>
						</div>
						<button type="button" class="extensionToggle" class:on={isOn(e.id)} role="switch" aria-checked={isOn(e.id)} aria-label="Toggle {e.name}" onclick={() => toggleExt(e.id)}>
							<span class="toggleKnob"></span>
						</button>
					</div>
				{/each}
			</div>
		{/if}
		<button type="button" class="button" onclick={(event) => { event.stopPropagation(); toggleSettings(); }} aria-label="Browser settings" aria-haspopup="true" aria-expanded={settingsOpen} aria-controls="browser-settings-dropdown"><svg class="ni dots" viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.5" cy="8" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="12.5" cy="8" r="1.3" /></svg></button>
		{#if settingsOpen}
			<div class="settings-overlay" onclick={closeSettings} role="presentation"></div>
			<div class="settings-dropdown" id="browser-settings-dropdown" aria-label="Browser settings">
				<button class="menuBtn" onclick={addTab}>New Tab</button>
				<button class="menuBtn" onclick={startBookmark}>Bookmark Site</button>
				<div class="break"></div>
				<p>Pr<span class="filler">ha67</span>oxy</p>
				<select bind:value={letheEngine} disabled={!ready}>
					<option value="sj2">SJ2</option>
					<option value="sj">SJ</option>
					<option value="uv">UV</option>
				</select>
				<p>Tran<span class="filler">ha67</span>sport</p>
				<select bind:value={car} disabled={!ready}>
					<option value="libcurl">Lib</option>
					<option value="epoxy">Epox</option>
				</select>
				<p>Wi<span class="filler">ha67</span>sp</p>
				<input bind:value={customWisp} placeholder="keep blank for default" type="text" aria-label="Custom Wisp server" />
				<div class="active-server" title={activeWispUrl}>
					<span>Active server</span>
					<code>{activeWispUrl}</code>
				</div>
				<p>Sea<span class="filler">ha67</span>rch Engine</p>
				<select bind:value={searchEngine}>
					<option value="ddg">DuckDuckGo</option>
					<option value="brave">Brave</option>
					<option value="google">Google</option>
				</select>
				<div class="break"></div>
				<button onclick={openInNewWindow}>Open in new tab</button>
				<div class="break"></div>
				<button onclick={toggleFullscreen}>Full Screen</button>
				<button onclick={openInspector}>Inspect Element</button>
			</div>
		{/if}
	</div>
</div>
{#snippet mark(bm, i)}
	<div
		class="mark"
		onclick={() => bookmarkSearch(bm.url, bm.lethe)}
		oncontextmenu={(e) => {
			e.preventDefault();
			removeBookmark(i);
		}}
	>
		<p class="markName">{bm.title}</p>
	</div>
{/snippet}

{#if bookmarks.length > 0}
	<div class="bookmarks">
		{#each bookmarks as bm, i}
			{@render mark(bm, i)}
		{/each}
	</div>
{/if}

<div class="frameContainer">
	{#each frames as frame (frame.id)}
		<Iframe
			id={frame.id}
			src={frame.url}
			onnavigate={(info) => handleNavigate(frame.id, info)}
			onnewtab={(url) => openInNewTab(url)}
			interceptEnabled={popupInterceptor}
			extensions={browserExtensions}
		/>
		{#if frame.id === $activeTab && !frame.url}
			<Home {ready} onsearch={(rawQuery) => navigateTo(rawQuery)} />
		{/if}
	{/each}
</div>
