<script>
	import { prefs } from './prefs.svelte.js';
	import { wm, focus, minimize, close, toggleMaximize, restore, snap, moveBy, resizeTo, MIN_W, MIN_H, workArea } from './wm.svelte.js';

	let { win } = $props();

	let loaded = $state(false);
	let closing = $state(false);
	const active = $derived(wm.activeId === win.id && !win.minimized);

	/* ---------- move ---------- */
	let drag = null;
	function dragStart(e) {
		if (e.button !== 0 || (e.target instanceof Element && e.target.closest('button'))) return;
		focus(win.id);
		e.currentTarget.setPointerCapture(e.pointerId);
		drag = { px: e.clientX, py: e.clientY, x: win.x, y: win.y, moved: false };
		wm.dragging = true;
	}
	function dragMove(e) {
		if (!drag) return;
		if (!drag.moved && Math.hypot(e.clientX - drag.px, e.clientY - drag.py) < 4) return;
		if (!drag.moved && (win.maximized || win.snap)) {
			// Pull out of maximised/snapped state with the cursor staying on the titlebar.
			const ratio = e.clientX / wm.vw;
			restore(win.id, { x: e.clientX, y: e.clientY - 16, ratio });
			drag.x = win.x;
			drag.y = win.y;
			drag.px = e.clientX;
			drag.py = e.clientY;
		}
		drag.moved = true;
		moveBy(win.id, drag.x + e.clientX - drag.px, drag.y + e.clientY - drag.py);
		wm.snapPreview = e.clientY < 8 ? 'top' : e.clientX < 8 ? 'left' : e.clientX > wm.vw - 8 ? 'right' : null;
	}
	function dragEnd(e) {
		if (!drag) return;
		if (wm.snapPreview && drag.moved) snap(win.id, wm.snapPreview);
		wm.snapPreview = null;
		wm.dragging = false;
		drag = null;
		e.currentTarget.releasePointerCapture?.(e.pointerId);
	}

	/* ---------- resize ---------- */
	let rs = null;
	function resizeStart(e, edge) {
		if (e.button !== 0 || win.maximized || win.snap) return;
		focus(win.id);
		e.currentTarget.setPointerCapture(e.pointerId);
		rs = { edge, px: e.clientX, py: e.clientY, x: win.x, y: win.y, w: win.w, h: win.h };
		wm.dragging = true;
	}
	function resizeMove(e) {
		if (!rs) return;
		const area = workArea();
		const dx = e.clientX - rs.px;
		const dy = e.clientY - rs.py;
		let { x, y, w, h } = rs;
		if (rs.edge.includes('e')) w = Math.max(MIN_W, rs.w + dx);
		if (rs.edge.includes('s')) h = Math.max(MIN_H, rs.h + dy);
		if (rs.edge.includes('w')) {
			w = Math.max(MIN_W, rs.w - dx);
			x = rs.x + rs.w - w;
		}
		if (rs.edge.includes('n')) {
			h = Math.max(MIN_H, rs.h - dy);
			y = rs.y + rs.h - h;
			if (y < area.y) {
				h -= area.y - y;
				y = area.y;
			}
		}
		resizeTo(win.id, { x, y, w, h });
	}
	function resizeEnd(e) {
		if (!rs) return;
		rs = null;
		wm.dragging = false;
		e.currentTarget.releasePointerCapture?.(e.pointerId);
	}

	function onClose() {
		closing = true;
		setTimeout(() => close(win.id), 140);
	}
	const edges = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
</script>

<div
	class="window"
	class:active
	class:minimized={win.minimized}
	class:maximized={win.maximized}
	class:snapLeft={win.snap === 'left'}
	class:snapRight={win.snap === 'right'}
	class:closing
	class:moving={wm.dragging && active}
	style:z-index={win.z}
	style:--x="{win.x}px"
	style:--y="{win.y}px"
	style:--w="{win.w}px"
	style:--h="{win.h}px"
	style:--r="{prefs.windowRadius}px"
	data-shadow={prefs.windowShadow}
	role="dialog"
	aria-label={win.title}
	aria-hidden={win.minimized}
	inert={win.minimized}
>
	{#each edges as edge}
		<div
			class="grip {edge}"
			onpointerdown={(e) => resizeStart(e, edge)}
			onpointermove={resizeMove}
			onpointerup={resizeEnd}
			onpointercancel={resizeEnd}
			role="presentation"
		></div>
	{/each}

	<header
		class="bar noSelect"
		onpointerdown={dragStart}
		onpointermove={dragMove}
		onpointerup={dragEnd}
		onpointercancel={dragEnd}
		ondblclick={(e) => !(e.target instanceof Element && e.target.closest('button')) && toggleMaximize(win.id)}
		role="presentation"
	>
		<div class="lights" class:mono={prefs.trafficLights === 'mono'}>
			<button type="button" class="tl close" aria-label="Close" onclick={onClose}>
				<svg viewBox="0 0 12 12"><path d="M3.6 3.6l4.8 4.8M8.4 3.6L3.6 8.4" /></svg>
			</button>
			<button type="button" class="tl min" aria-label="Minimize" onclick={() => minimize(win.id)}>
				<svg viewBox="0 0 12 12"><path d="M3 6h6" /></svg>
			</button>
			<button type="button" class="tl max" aria-label={win.maximized || win.snap ? 'Restore' : 'Zoom'} onclick={() => toggleMaximize(win.id)}>
				<svg viewBox="0 0 12 12"><path d="M7 2.9h2.1V5M9.1 2.9L6.6 5.4M5 9.1H2.9V7M2.9 9.1l2.5-2.5" /></svg>
			</button>
		</div>
		<p class="title"><img src={win.icon} alt="" draggable="false" />{win.title}</p>
		<div class="balance"></div>
	</header>

	<div class="body">
		{#if !loaded}<div class="loading" aria-hidden="true"><span></span></div>{/if}
		<iframe src={win.url} title={win.title} onload={() => (loaded = true)}></iframe>
		{#if !active}
			<!-- Catches the first click on an unfocused window so it can be raised, since iframes swallow events. -->
			<div class="shield" onpointerdown={() => focus(win.id)} role="presentation"></div>
		{/if}
	</div>
</div>

<style>
	.window {
		--sh: 0 10px 30px rgba(0, 0, 0, 0.3), 0 0 0 0.5px rgba(255, 255, 255, 0.14);
		--sh-active: 0 22px 60px rgba(0, 0, 0, 0.5), 0 0 0 0.5px rgba(255, 255, 255, 0.26);
		position: absolute;
		top: 0;
		left: 0;
		width: var(--w);
		height: var(--h);
		transform: translate3d(var(--x), var(--y), 0);
		display: flex;
		flex-direction: column;
		border-radius: var(--r);
		background: var(--color-surface-3);
		box-shadow: var(--sh);
		contain: layout style;
		transition:
			opacity var(--dur) var(--ease-out),
			scale var(--dur) var(--ease-out),
			box-shadow var(--dur),
			width var(--dur) var(--ease-out),
			height var(--dur) var(--ease-out),
			transform var(--dur) var(--ease-out);
		animation: pop 220ms var(--ease-out);
	}
	.window[data-shadow='none'] {
		--sh: 0 0 0 0.5px rgba(255, 255, 255, 0.2);
		--sh-active: 0 0 0 0.5px rgba(255, 255, 255, 0.3);
	}
	.window[data-shadow='deep'] {
		--sh: 0 18px 50px rgba(0, 0, 0, 0.45), 0 0 0 0.5px rgba(255, 255, 255, 0.14);
		--sh-active: 0 36px 90px rgba(0, 0, 0, 0.7), 0 0 0 0.5px rgba(255, 255, 255, 0.28);
	}
	.window.active {
		box-shadow: var(--sh-active);
	}
	/* the focused window picks up a faint glow in the accent colour */
	.window.active:not([data-shadow='none']):not(.maximized) {
		box-shadow:
			var(--sh-active),
			0 0 70px -22px color-mix(in srgb, var(--os-accent, #0a84ff) 50%, transparent);
	}
	.window.moving {
		transition: none;
		will-change: transform;
	}
	.window.minimized {
		opacity: 0;
		scale: 0.85;
		pointer-events: none;
		visibility: hidden;
		transition:
			opacity var(--dur),
			scale var(--dur),
			visibility 0s var(--dur);
	}
	.window.closing {
		opacity: 0;
		scale: 0.94;
		pointer-events: none;
		transition:
			opacity 140ms,
			scale 140ms;
	}
	.window.maximized {
		width: calc(100vw - var(--il) - var(--ir));
		height: calc(100vh - var(--it) - var(--ib));
		transform: translate3d(var(--il), var(--it), 0);
		border-radius: 0;
	}
	.window.snapLeft,
	.window.snapRight {
		width: calc((100vw - var(--il) - var(--ir)) / 2);
		height: calc(100vh - var(--it) - var(--ib));
		border-radius: 0;
	}
	.window.snapLeft {
		transform: translate3d(var(--il), var(--it), 0);
	}
	.window.snapRight {
		transform: translate3d(calc(var(--il) + (100vw - var(--il) - var(--ir)) / 2), var(--it), 0);
	}
	@keyframes pop {
		from {
			opacity: 0;
			scale: 0.94;
		}
	}

	.bar {
		flex: none;
		height: 38px;
		display: flex;
		align-items: center;
		padding: 0 14px;
		border-radius: var(--r) var(--r) 0 0;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0) 70%),
			var(--color-surface-2);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.07),
			inset 0 -1px 0 var(--color-border);
		cursor: default;
		touch-action: none;
	}
	.window:not(.active) .bar {
		background: var(--color-surface);
	}
	.maximized .bar,
	.snapLeft .bar,
	.snapRight .bar {
		border-radius: 0;
	}

	.lights {
		display: flex;
		gap: 8px;
		width: 62px;
	}
	.tl {
		position: relative;
		display: grid;
		place-items: center;
		width: 12px;
		height: 12px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		--c: #ff5f57;
		background: radial-gradient(circle at 36% 28%, rgba(255, 255, 255, 0.5), transparent 58%), var(--c);
		box-shadow:
			inset 0 0 0 0.5px rgba(0, 0, 0, 0.28),
			0 1px 2px rgba(0, 0, 0, 0.25);
		transition:
			filter var(--dur-fast),
			scale var(--dur-fast);
	}
	.tl.min {
		--c: #febc2e;
	}
	.tl.max {
		--c: #28c840;
	}
	.tl:hover {
		filter: brightness(1.08);
	}
	.tl:active {
		scale: 0.9;
	}
	.window:not(.active) .tl {
		background: var(--color-surface-3);
		box-shadow: inset 0 0 0 1px var(--color-border-strong);
	}
	.lights.mono .tl,
	.lights.mono .tl.min,
	.lights.mono .tl.max {
		background: var(--color-border-strong);
	}
	.tl svg {
		width: 10px;
		height: 10px;
		fill: none;
		stroke: rgba(0, 0, 0, 0.66);
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
		opacity: 0;
		transition: opacity var(--dur-fast);
	}
	.tl.max svg {
		stroke-width: 1.4;
	}
	.lights:hover .tl svg {
		opacity: 1;
	}
	.tl:active {
		filter: brightness(0.8);
	}

	.title {
		flex: 1;
		min-width: 0;
		margin: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		font-family: var(--font-family-title);
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.title img {
		width: 14px;
		height: 14px;
		object-fit: contain;
		flex: none;
	}
	.window:not(.active) .title {
		opacity: 0.5;
	}
	.balance {
		width: 62px;
	}

	.body {
		position: relative;
		flex: 1;
		min-height: 0;
		border-radius: 0 0 var(--r) var(--r);
		overflow: hidden;
		background: var(--color-surface-3);
	}
	.maximized .body,
	.snapLeft .body,
	.snapRight .body {
		border-radius: 0;
	}
	iframe {
		width: 100%;
		height: 100%;
		border: 0;
		display: block;
		background: var(--color-surface-3);
	}
	:global(.desktop.dragging) iframe {
		pointer-events: none;
	}
	.shield {
		position: absolute;
		inset: 0;
	}
	.loading {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		pointer-events: none;
	}
	.loading span {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 2px solid var(--color-border-strong);
		border-top-color: var(--os-accent, var(--color-text));
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}

	/* resize grips sit just outside the visual edge */
	.grip {
		position: absolute;
		z-index: 5;
		touch-action: none;
	}
	.maximized .grip,
	.snapLeft .grip,
	.snapRight .grip {
		display: none;
	}
	.grip.n,
	.grip.s {
		left: 10px;
		right: 10px;
		height: 8px;
		cursor: ns-resize;
	}
	.grip.e,
	.grip.w {
		top: 10px;
		bottom: 10px;
		width: 8px;
		cursor: ew-resize;
	}
	.grip.n {
		top: -4px;
	}
	.grip.s {
		bottom: -4px;
	}
	.grip.e {
		right: -4px;
	}
	.grip.w {
		left: -4px;
	}
	.grip.ne,
	.grip.nw,
	.grip.se,
	.grip.sw {
		width: 14px;
		height: 14px;
	}
	.grip.ne {
		top: -4px;
		right: -4px;
		cursor: nesw-resize;
	}
	.grip.nw {
		top: -4px;
		left: -4px;
		cursor: nwse-resize;
	}
	.grip.se {
		bottom: -4px;
		right: -4px;
		cursor: nwse-resize;
	}
	.grip.sw {
		bottom: -4px;
		left: -4px;
		cursor: nesw-resize;
	}
</style>
