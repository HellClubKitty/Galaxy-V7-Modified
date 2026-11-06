<script>
	// Runs the extensions. Built-ins live here; imported ones run in sandboxed iframes and talk to
	// Hopium through postMessage (toast, a menu bar label, open an app, hear clicks).
	import { onMount } from 'svelte';
	import { ext, extBar, isOn, extensionDoc } from './extensions.svelte.js';
	import { wm, toast, snap, toggleMaximize, minimize } from './wm.svelte.js';
	import { loadSetting, saveSetting } from '$lib/utils/localspace.js';

	let { apps = [], onopenapp } = $props();

	/* ---------- Focus Timer ---------- */
	const FOCUS = 25 * 60;
	let timer = $state({ running: false, left: FOCUS });
	onMount(() => {
		const t = setInterval(() => {
			if (!isOn('focus-timer') || !timer.running) return;
			timer.left -= 1;
			if (timer.left <= 0) {
				timer = { running: false, left: FOCUS };
				toast('Focus session done. Take a break.', 5000);
			}
		}, 1000);
		return () => clearInterval(t);
	});
	const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	function clickTimer() {
		if (timer.running) timer.running = false;
		else {
			if (timer.left <= 0) timer.left = FOCUS;
			timer.running = true;
			toast('Focus session started');
		}
	}

	/* ---------- Night Shade ---------- */
	let shade = $state(false);
	onMount(() => {
		loadSetting('nightShade', false).then((v) => (shade = v === true)).catch(() => {});
	});
	function clickShade() {
		shade = !shade;
		saveSetting('nightShade', shade);
	}

	/* ---------- keyboard: Window Tiler + Quick Launch ---------- */
	function keydown(e) {
		if (isOn('window-tiler') && e.ctrlKey && e.altKey && !e.metaKey && wm.activeId) {
			const id = wm.activeId;
			const map = { ArrowLeft: () => snap(id, 'left'), ArrowRight: () => snap(id, 'right'), ArrowUp: () => toggleMaximize(id), ArrowDown: () => minimize(id) };
			if (map[e.key]) {
				e.preventDefault();
				map[e.key]();
				return;
			}
		}
		if (isOn('quick-launch') && e.altKey && !e.ctrlKey && !e.metaKey) {
			const n = /^Digit([1-9])$/.exec(e.code)?.[1];
			const app = n && apps[Number(n) - 1];
			if (app) {
				e.preventDefault();
				onopenapp?.(app);
			}
		}
	}

	/* ---------- imported extensions ---------- */
	let labels = $state({}); // id -> menu bar text
	const frames = {}; // id -> iframe element
	let lastToast = 0;
	function message(e) {
		const d = e.data;
		if (!d || typeof d !== 'object' || typeof d.hopium !== 'string') return;
		const el = frames[d.hopium];
		if (!el || e.source !== el.contentWindow) return; // only accept messages from our own frames
		if (d.type === 'toast') {
			const now = Date.now();
			if (now - lastToast > 800) (lastToast = now, toast(d.text));
		} else if (d.type === 'bar') labels[d.hopium] = d.text;
		else if (d.type === 'open') {
			const app = apps.find((a) => a.id === d.app || a.name.toLowerCase() === String(d.app).toLowerCase());
			if (app) onopenapp?.(app);
		}
	}
	const clicked = (id) => frames[id]?.contentWindow?.postMessage({ type: 'click' }, '*');

	/* ---------- what the menu bar shows ---------- */
	$effect(() => {
		const items = [];
		if (isOn('focus-timer')) items.push({ id: 'focus-timer', icon: 'timer', label: timer.running || timer.left < FOCUS ? mmss(timer.left) : 'Focus', active: timer.running, onclick: clickTimer });
		if (isOn('night-shade')) items.push({ id: 'night-shade', icon: 'moon', label: '', active: shade, onclick: clickShade });
		for (const u of ext.user) if (isOn(u.id) && labels[u.id]) items.push({ id: u.id, icon: '', label: labels[u.id], active: false, onclick: () => clicked(u.id) });
		extBar.items = items;
		return () => (extBar.items = []);
	});
</script>

<svelte:window onkeydown={keydown} onmessage={message} />

{#if isOn('night-shade') && shade}<div class="shade" aria-hidden="true"></div>{/if}

{#each ext.user.filter((u) => isOn(u.id)) as u (u.id)}
	<iframe
		class="host"
		title={u.name}
		sandbox="allow-scripts"
		srcdoc={extensionDoc(u.id, u.code)}
		bind:this={frames[u.id]}
	></iframe>
{/each}

<style>
	.host {
		position: absolute;
		width: 0;
		height: 0;
		border: 0;
		opacity: 0;
		pointer-events: none;
	}
	.shade {
		position: absolute;
		inset: 0;
		z-index: 9800;
		pointer-events: none;
		background: rgba(255, 130, 30, 0.2);
		mix-blend-mode: multiply;
		box-shadow: inset 0 0 0 100vmax rgba(0, 0, 0, 0.12);
	}
</style>
