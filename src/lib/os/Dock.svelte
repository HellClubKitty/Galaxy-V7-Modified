<script>
	import { wm, windowsOf, focus, close } from './wm.svelte.js';
	import { prefs } from './prefs.svelte.js';
	import AppIcon from './AppIcon.svelte';

	let { apps, oncontext, onlaunch, onlaunchpad, launchpadOpen } = $props();

	const pos = $derived(prefs.dockPos);
	const vertical = $derived(pos !== 'bottom');
	const size = $derived(prefs.dockSize);

	let preview = $state(/** @type {{ appId: string, x: number, y: number } | null} */ (null));
	let bouncing = $state(null);
	let shown = $state(true);
	let hot = $state(false);
	let scales = $state({});
	let nav;
	let centers = [];
	let raf = 0;
	let hideTimer;
	let hoverTimer;
	let hideDock;

	/* ---------- magnification ---------- */
	function measure() {
		centers = [...nav.querySelectorAll('.item')].map((el) => {
			const r = el.getBoundingClientRect();
			return { id: el.dataset.id, c: vertical ? r.top + r.height / 2 : r.left + r.width / 2 };
		});
	}
	function enterDock() {
		clearTimeout(hideDock);
		shown = true;
		if (!prefs.magnify) return;
		measure();
		hot = true;
	}
	function moveDock(e) {
		if (!prefs.magnify || !hot) return;
		const p = vertical ? e.clientY : e.clientX;
		cancelAnimationFrame(raf);
		raf = requestAnimationFrame(() => {
			const reach = size * 2.6;
			const next = {};
			for (const { id, c } of centers) {
				const d = Math.abs(p - c);
				next[id] = d < reach ? 1 + (prefs.magnifyAmount - 1) * (0.5 + 0.5 * Math.cos((Math.PI * d) / reach)) : 1;
			}
			scales = next;
		});
	}
	function leaveDock() {
		cancelAnimationFrame(raf);
		hot = false;
		scales = {};
		if (prefs.dockAutoHide) hideDock = setTimeout(() => (shown = false), 350);
	}
	$effect(() => {
		if (!prefs.dockAutoHide) shown = true;
		else shown = false;
	});

	/* ---------- launching ---------- */
	function click(app, e) {
		preview = null;
		const r = e.currentTarget.getBoundingClientRect();
		const point = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
		const wasClosed = windowsOf(app.id).length === 0;
		const result = onlaunch(app);
		if (wasClosed) {
			bouncing = app.id;
			setTimeout(() => (bouncing = null), 900);
		}
		if (Array.isArray(result)) preview = { appId: app.id, ...point };
	}
	function enter(e, app) {
		const r = e.currentTarget.getBoundingClientRect();
		const point = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
		clearTimeout(hideTimer);
		clearTimeout(hoverTimer);
		hoverTimer = setTimeout(() => {
			if (windowsOf(app.id).length > 1) preview = { appId: app.id, ...point };
		}, 400);
	}
	function leave() {
		clearTimeout(hoverTimer);
		hideTimer = setTimeout(() => (preview = null), 220);
	}
	const stateOf = (id) => {
		const wins = windowsOf(id);
		return { count: wins.length, active: wins.some((w) => w.id === wm.activeId && !w.minimized) };
	};
	const scaleOf = (id) => scales[id] ?? 1;
</script>

{#if prefs.dockAutoHide}
	<div class="zone {pos}" onpointerenter={enterDock} role="presentation"></div>
{/if}

{#if preview}
	{@const wins = windowsOf(preview.appId)}
	{#if wins.length}
		<div
			class="preview {pos}"
			style:left={pos === 'bottom' ? `${preview.x}px` : null}
			style:top={pos === 'bottom' ? null : `${preview.y}px`}
			style:--gap="{size + 30}px"
			onpointerenter={() => clearTimeout(hideTimer)}
			onpointerleave={leave}
			role="menu"
			tabindex="-1"
		>
			{#each wins as w (w.id)}
				<div class="card" class:current={w.id === wm.activeId}>
					<button class="open" onclick={() => (focus(w.id), (preview = null))}>
						<img src={w.icon} alt="" />
						<span>{w.title}</span>
					</button>
					<button class="x" aria-label="Close {w.title}" onclick={() => close(w.id)}><svg viewBox="0 0 12 12"><path d="M3.4 3.4l5.2 5.2M8.6 3.4L3.4 8.6" /></svg></button>
				</div>
			{/each}
		</div>
	{/if}
{/if}

<nav
	bind:this={nav}
	class="dock noSelect {pos}"
	class:hidden={prefs.dockAutoHide && !shown}
	class:hot
	style:--icon="{size}px"
	onpointerenter={enterDock}
	onpointermove={moveDock}
	onpointerleave={leaveDock}
	onpointerdown={(e) => e.stopPropagation()}
	oncontextmenu={(e) => oncontext(e, null)}
	aria-label="Dock"
>
	<button
		class="item"
		data-id="__launchpad"
		class:active={launchpadOpen}
		style:--sc={scaleOf('__launchpad')}
		onclick={onlaunchpad}
		aria-label="Launchpad"
	>
		<span class="launchpad">
			<svg viewBox="0 0 24 24" aria-hidden="true">
				{#each [0, 1, 2] as r}{#each [0, 1, 2] as c}<rect x={3 + c * 7} y={3 + r * 7} width="4.6" height="4.6" rx="1.2" />{/each}{/each}
			</svg>
		</span>
		<span class="tip">Launchpad</span>
	</button>
	<i class="sep"></i>
	{#each apps as app (app.id)}
		{@const st = stateOf(app.id)}
		<button
			class="item"
			data-id={app.id}
			class:active={st.active}
			class:bounce={bouncing === app.id}
			style:--sc={scaleOf(app.id)}
			onclick={(e) => click(app, e)}
			oncontextmenu={(e) => oncontext(e, app)}
			onpointerenter={(e) => enter(e, app)}
			onpointerleave={leave}
			aria-label={app.name}
		>
			<AppIcon {app} size={size * 0.82} />
			<span class="tip">{app.name}</span>
			{#if st.count}<i class="dot" class:many={st.count > 1}></i>{/if}
		</button>
	{/each}
</nav>

<style>
	.dock {
		position: absolute;
		z-index: 8000;
		display: flex;
		align-items: flex-end;
		gap: 4px;
		padding: 6px;
		border-radius: 24px;
		background: var(--glass-light, rgba(255, 255, 255, 0.14));
		backdrop-filter: var(--glass-filter, blur(26px) saturate(1.8));
		box-shadow: var(--glass-edge, inset 0 0 0 0.5px rgba(255, 255, 255, 0.34)), var(--glass-drop, 0 12px 32px rgba(0, 0, 0, 0.35));
		transition:
			translate 260ms var(--ease-out),
			opacity 200ms;
	}
	/* glossy sheen across the top half of the glass */
	.dock::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0) 46%);
		pointer-events: none;
	}
	.dock.bottom {
		bottom: 8px;
		left: 50%;
		translate: -50% 0;
	}
	.dock.left,
	.dock.right {
		top: calc(50% + 14px);
		flex-direction: column;
		align-items: flex-start;
		transform: translateY(-50%);
	}
	.dock.left {
		left: 8px;
	}
	.dock.right {
		right: 8px;
		align-items: flex-end;
	}
	.dock.bottom.hidden {
		translate: -50% 140%;
	}
	.dock.left.hidden {
		translate: -140% 0;
	}
	.dock.right.hidden {
		translate: 140% 0;
	}
	.zone {
		position: absolute;
		z-index: 7900;
	}
	.zone.bottom {
		inset: auto 0 0 0;
		height: 6px;
	}
	.zone.left {
		inset: 28px auto 0 0;
		width: 6px;
	}
	.zone.right {
		inset: 28px 0 0 auto;
		width: 6px;
	}

	.item {
		position: relative;
		flex: none;
		width: calc(var(--icon) * var(--sc, 1));
		height: calc(var(--icon) * var(--sc, 1));
		padding: 0;
		border: 0;
		background: transparent;
		display: grid;
		place-items: center;
		transition:
			width 160ms var(--ease-out),
			height 160ms var(--ease-out);
	}
	.hot .item {
		transition: none;
	}
	.item > :global(.ai) {
		width: 82% !important;
		height: 82% !important;
	}
	.item:active > :global(.ai),
	.item:active > .launchpad {
		filter: brightness(0.7);
	}
	.launchpad {
		display: grid;
		place-items: center;
		width: 82%;
		height: 82%;
		border-radius: 23%;
		background: linear-gradient(180deg, #5a5c63, #35373c);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
	}
	.launchpad svg {
		width: 62%;
		height: 62%;
		fill: #fff;
	}
	.sep {
		flex: none;
		align-self: center;
		width: 1px;
		height: calc(var(--icon) * 0.7);
		margin: 0 3px;
		background: rgba(255, 255, 255, 0.28);
	}
	.dock.left .sep,
	.dock.right .sep {
		width: calc(var(--icon) * 0.7);
		height: 1px;
		margin: 3px 0;
	}

	.dot {
		position: absolute;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 0 6px 1px color-mix(in srgb, var(--os-accent, #0a84ff) 70%, #fff);
	}
	.dock.bottom .dot {
		bottom: -4px;
		left: 50%;
		translate: -50% 0;
	}
	.dock.left .dot {
		left: -4px;
		top: 50%;
		translate: 0 -50%;
	}
	.dock.right .dot {
		right: -4px;
		top: 50%;
		translate: 0 -50%;
	}
	.dot.many {
		width: 4px;
		box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.35);
	}

	.tip {
		position: absolute;
		padding: 4px 10px;
		border-radius: 7px;
		background: var(--glass-panel, rgba(30, 30, 33, 0.86));
		backdrop-filter: blur(16px) saturate(1.6);
		box-shadow: var(--glass-edge, inset 0 0 0 0.5px rgba(255, 255, 255, 0.22)), 0 6px 16px rgba(0, 0, 0, 0.3);
		font-size: 12px;
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		transition: opacity 100ms;
	}
	.dock.bottom .tip {
		bottom: calc(100% + 14px);
		left: 50%;
		translate: -50% 0;
	}
	.dock.left .tip {
		left: calc(100% + 14px);
		top: 50%;
		translate: 0 -50%;
	}
	.dock.right .tip {
		right: calc(100% + 14px);
		top: 50%;
		translate: 0 -50%;
	}
	.item:hover .tip {
		opacity: 1;
	}

	.bounce > :global(.ai) {
		animation: bounce-b 0.9s ease-out;
	}
	.dock.left .bounce > :global(.ai) {
		animation-name: bounce-l;
	}
	.dock.right .bounce > :global(.ai) {
		animation-name: bounce-r;
	}
	@keyframes bounce-b {
		0%, 100% { translate: 0 0; }
		25%, 65% { translate: 0 -18px; }
		45%, 85% { translate: 0 0; }
	}
	@keyframes bounce-l {
		0%, 100% { translate: 0 0; }
		25%, 65% { translate: 18px 0; }
		45%, 85% { translate: 0 0; }
	}
	@keyframes bounce-r {
		0%, 100% { translate: 0 0; }
		25%, 65% { translate: -18px 0; }
		45%, 85% { translate: 0 0; }
	}

	.preview {
		position: absolute;
		z-index: 8500;
		display: flex;
		gap: 8px;
		padding: 8px;
		border-radius: 14px;
		background: var(--glass-panel, rgba(40, 40, 44, 0.82));
		backdrop-filter: var(--glass-filter, blur(30px) saturate(1.6));
		box-shadow: var(--glass-edge, inset 0 0 0 0.5px rgba(255, 255, 255, 0.22)), var(--glass-drop, 0 12px 32px rgba(0, 0, 0, 0.4));
		animation: fade var(--dur) var(--ease-out);
	}
	.preview.bottom {
		bottom: var(--gap);
		translate: -50% 0;
	}
	.preview.left {
		left: var(--gap);
		translate: 0 -50%;
		flex-direction: column;
	}
	.preview.right {
		right: var(--gap);
		translate: 0 -50%;
		flex-direction: column;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	.card {
		display: flex;
		align-items: center;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid transparent;
	}
	.card.current {
		border-color: rgba(255, 255, 255, 0.3);
	}
	.card:hover {
		background: rgba(255, 255, 255, 0.16);
	}
	.open {
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: 190px;
		padding: 10px 6px 10px 12px;
		border: 0;
		background: none;
		font-size: 12px;
		color: #fff;
	}
	.open img {
		width: 18px;
		height: 18px;
	}
	.open span {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.x {
		width: 24px;
		height: 24px;
		margin-right: 6px;
		border: 0;
		border-radius: 50%;
		background: transparent;
		display: grid;
		place-items: center;
		color: #fff;
	}
	.x svg {
		width: 11px;
		height: 11px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
	}
	.x:hover {
		background: #ff453a;
	}
</style>
