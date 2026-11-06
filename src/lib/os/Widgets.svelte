<script>
	import { onMount } from 'svelte';
	import { prefs } from './prefs.svelte.js';
	import { wm, toast } from './wm.svelte.js';
	import { widgets, allWidgets, moveWidget, commitWidgets, toggleWidget, setEditing, importWidget, widgetDoc } from './widgets.svelte.js';
	import { sp, control } from './spotify.svelte.js';
	import { loadSetting, saveSetting, onSettingChange } from '$lib/utils/localspace.js';

	let { onspotify } = $props();

	const list = $derived(allWidgets());

	/* ---------- time ---------- */
	let now = $state(new Date());
	onMount(() => {
		// Smooth second hand when animations are on, otherwise once a second.
		const every = () => (prefs.animations ? 80 : 1000);
		let t;
		const tick = () => {
			if (!document.hidden) now = new Date();
			t = setTimeout(tick, every());
		};
		tick();
		return () => clearTimeout(t);
	});

	const hourDeg = $derived(((now.getHours() % 12) + now.getMinutes() / 60) * 30);
	const minDeg = $derived((now.getMinutes() + now.getSeconds() / 60) * 6);
	const secDeg = $derived((now.getSeconds() + (prefs.animations ? now.getMilliseconds() / 1000 : 0)) * 6);
	const dayLabel = $derived(now.toLocaleDateString([], { weekday: 'short' }).toUpperCase());
	const ticks = Array.from({ length: 60 }, (_, i) => i);
	const numerals = [
		[12, 50, 25],
		[3, 75.5, 50],
		[6, 50, 75.5],
		[9, 24.5, 50]
	];

	/* ---------- calendar ---------- */
	const monthName = $derived(now.toLocaleDateString([], { month: 'long' }));
	const yearNum = $derived(now.getFullYear());
	const weekdayLong = $derived(now.toLocaleDateString([], { weekday: 'long' }));
	const cells = $derived.by(() => {
		const y = now.getFullYear();
		const m = now.getMonth();
		const lead = new Date(y, m, 1).getDay();
		const days = new Date(y, m + 1, 0).getDate();
		return [...Array(lead).fill(0), ...Array.from({ length: days }, (_, i) => i + 1)];
	});
	const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

	/* ---------- notes ---------- */
	let note = $state('');
	let noteTimer;
	onMount(() => {
		loadSetting('notes', '').then((v) => (note = typeof v === 'string' ? v : '')).catch(() => {});
		return onSettingChange('notes', (v) => (note = typeof v === 'string' ? v : ''));
	});
	function editNote(e) {
		note = e.currentTarget.value;
		clearTimeout(noteTimer);
		noteTimer = setTimeout(() => saveSetting('notes', note), 450);
	}

	/* ---------- now playing ---------- */
	const pct = $derived(sp.duration ? Math.min(100, (sp.progress / sp.duration) * 100) : 0);
	async function act(action) {
		const r = await control(action);
		if (r.message) toast(r.message);
	}

	/* ---------- system ---------- */
	let battery = $state(null); // { level 0..1, charging }
	let online = $state(true);
	let sessionMin = $state(0);
	const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : null;
	const memory = typeof navigator !== 'undefined' ? navigator.deviceMemory : null;
	onMount(() => {
		online = navigator.onLine;
		const on = () => (online = true);
		const off = () => (online = false);
		addEventListener('online', on);
		addEventListener('offline', off);
		const min = setInterval(() => (sessionMin = Math.floor(performance.now() / 60000)), 15000);
		let bat;
		const sync = () => bat && (battery = { level: bat.level, charging: bat.charging });
		navigator.getBattery?.().then((b) => {
			bat = b;
			sync();
			['levelchange', 'chargingchange'].forEach((ev) => b.addEventListener(ev, sync));
		}).catch(() => {});
		return () => {
			removeEventListener('online', on);
			removeEventListener('offline', off);
			clearInterval(min);
		};
	});
	const ring = 2 * Math.PI * 22;
	const sessionText = $derived(sessionMin < 1 ? 'Just started' : sessionMin < 60 ? `${sessionMin}m session` : `${Math.floor(sessionMin / 60)}h ${sessionMin % 60}m session`);

	/* ---------- dragging ---------- */
	let drag = null;
	let dragId = $state(null);
	function down(e, w) {
		if (e.button !== 0 || e.target.closest('button, textarea, input, a, label')) return;
		const it = widgets.items[w.id];
		e.currentTarget.setPointerCapture(e.pointerId);
		drag = { id: w.id, w, px: e.clientX, py: e.clientY, x: it.x, y: it.y };
		dragId = w.id;
	}
	function move(e) {
		if (!drag) return;
		const { w } = drag;
		const maxX = wm.vw - wm.inset.left - wm.inset.right - w.w - 8;
		const maxY = wm.vh - wm.inset.bottom - w.h - 8;
		const x = Math.min(Math.max(8, drag.x - (e.clientX - drag.px)), Math.max(8, maxX));
		const y = Math.min(Math.max(wm.inset.top + 6, drag.y + (e.clientY - drag.py)), Math.max(wm.inset.top + 6, maxY));
		moveWidget(drag.id, x, y);
	}
	function up(e) {
		if (!drag) return;
		drag = null;
		dragId = null;
		e.currentTarget.releasePointerCapture?.(e.pointerId);
		commitWidgets();
	}

	/* ---------- edit mode ---------- */
	async function pickFiles(e) {
		const input = e.currentTarget;
		for (const file of input.files ?? []) {
			try {
				const w = importWidget(await file.text(), file.name);
				toast(`Added “${w.name}”`);
			} catch (err) {
				toast(err.message);
			}
		}
		input.value = '';
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && widgets.editing && setEditing(false)} />

{#if widgets.show}
	<div class="layer" class:editing={widgets.editing}>
		{#each list as w, i (w.id)}
			{@const it = widgets.items[w.id]}
			{#if it?.on}
				<section
					class="w {w.id}"
					class:custom={w.custom}
					class:drag={dragId === w.id}
					class:edit={widgets.editing}
					style:--i={i}
					style:width="{w.w}px"
					style:height="{w.h}px"
					style:right="min(calc(var(--ir) + {it.x}px), calc(100vw - {w.w + 8}px))"
					style:top="min({it.y}px, calc(100vh - {w.h + 8}px))"
					onpointerdown={(e) => down(e, w)}
					onpointermove={move}
					onpointerup={up}
					onpointercancel={up}
					aria-label={w.name}
				>
					{#if widgets.editing}
						<button class="badge" aria-label="Remove {w.name}" onclick={() => toggleWidget(w.id)}>
							<svg viewBox="0 0 12 12"><path d="M3 6h6" /></svg>
						</button>
					{/if}

					{#if w.id === 'clock'}
						<svg viewBox="0 0 100 100" aria-label="Clock">
							<circle cx="50" cy="50" r="47.5" class="rim" />
							{#each ticks as t}
								<line x1="50" y1={t % 5 === 0 ? 7 : 8} x2="50" y2={t % 5 === 0 ? 11.5 : 10} class="tick" class:major={t % 5 === 0} transform="rotate({t * 6} 50 50)" />
							{/each}
							{#each numerals as [n, x, y]}
								<text {x} y={y + 3.2} class="num">{n}</text>
							{/each}
							<g class="plate">
								<rect x="36" y="60" width="28" height="9.5" rx="4.75" />
								<text x="50" y="66.8" class="day">{dayLabel} {now.getDate()}</text>
							</g>
							<g class="shadow">
								<line x1="50" y1="54" x2="50" y2="30" class="hand hour" transform="rotate({hourDeg} 50 50)" />
								<line x1="50" y1="56" x2="50" y2="19" class="hand min" transform="rotate({minDeg} 50 50)" />
							</g>
							<g transform="rotate({secDeg} 50 50)">
								<line x1="50" y1="62" x2="50" y2="13" class="hand sec" />
								<circle cx="50" cy="50" r="2.8" class="pin" />
							</g>
							<circle cx="50" cy="50" r="1.1" class="cap" />
						</svg>
					{:else if w.id === 'calendar'}
						<header>
							<div class="when">
								<span class="wd">{weekdayLong}</span>
								<b>{monthName}</b>
							</div>
							<span class="yr">{yearNum}</span>
						</header>
						<div class="grid">
							{#each letters as l, li}<i class="dow" class:wk={li === 0 || li === 6}>{l}</i>{/each}
							{#each cells as d, ci}
								{#if d}
									<i class="day-cell" class:wk={ci % 7 === 0 || ci % 7 === 6} class:today={d === now.getDate()}>{d}</i>
								{:else}<i></i>{/if}
							{/each}
						</div>
					{:else if w.id === 'notes'}
						<header class="notesHead">
							<svg viewBox="0 0 16 16"><path d="M3.5 2.5h9v11h-9zM6 6h4M6 8.5h4M6 11h2" /></svg>
							<b>Notes</b>
						</header>
						<textarea value={note} oninput={editNote} placeholder="Jot something down…" spellcheck="false"></textarea>
					{:else if w.id === 'spotify'}
						{#if sp.connected && sp.track}
							<div class="tint" style:background-image={sp.track.art ? `url(${sp.track.art})` : null}></div>
							<div class="np">
								<div class="art" class:still={!sp.isPlaying} style:background-image={sp.track.art ? `url(${sp.track.art})` : null}></div>
								<div class="meta">
									<b title={sp.track.name}>{sp.track.name}</b>
									<span>{sp.track.artist}</span>
									<div class="ctl">
										<button aria-label="Previous" onclick={() => act('prev')}>
											<svg viewBox="0 0 16 16"><path d="M4 3v10M13 3.2v9.6L6.2 8z" /></svg>
										</button>
										<button class="pp" aria-label={sp.isPlaying ? 'Pause' : 'Play'} onclick={() => act(sp.isPlaying ? 'pause' : 'play')}>
											{#if sp.isPlaying}
												<svg viewBox="0 0 16 16"><path d="M5 3h2v10H5zM9 3h2v10H9z" /></svg>
											{:else}
												<svg viewBox="0 0 16 16"><path d="M5 3l8 5-8 5z" /></svg>
											{/if}
										</button>
										<button aria-label="Next" onclick={() => act('next')}>
											<svg viewBox="0 0 16 16"><path d="M12 3v10M3 3.2v9.6L9.8 8z" /></svg>
										</button>
									</div>
								</div>
							</div>
							<div class="line"><i style:width="{pct}%"></i></div>
						{:else}
							<div class="np off">
								<span class="mark"><svg viewBox="0 0 16 16"><path d="M2.6 5.6c3.5-1.1 7.6-.8 10.8 1M3.2 8.4c3-.9 6.4-.6 9.2.9M3.8 11c2.5-.6 5-.4 7.2.8" /></svg></span>
								<div class="meta">
									<b>{sp.connected ? 'Nothing playing' : 'Spotify'}</b>
									{#if sp.connected}
										<span>Press play on any device</span>
									{:else}
										<button class="link" onclick={onspotify}>Connect…</button>
									{/if}
								</div>
							</div>
						{/if}
					{:else if w.id === 'system'}
						<div class="sys">
							<svg class="batt" viewBox="0 0 56 56" aria-label="Battery">
								<circle cx="28" cy="28" r="22" class="trk" />
								{#if battery}
									<circle cx="28" cy="28" r="22" class="val" class:low={battery.level <= 0.2 && !battery.charging} stroke-dasharray="{ring * battery.level} {ring}" transform="rotate(-90 28 28)" />
									<text x="28" y="32.4" class="pc">{Math.round(battery.level * 100)}</text>
								{:else}
									<text x="28" y="32.4" class="pc dim">—</text>
								{/if}
							</svg>
							<div class="meta">
								<b>{battery ? (battery.charging ? 'Charging' : 'On battery') : 'Power'}</b>
								<span>{cores ? `${cores} ${cores === 1 ? 'core' : 'cores'}` : ''}{cores && memory ? ' · ' : ''}{memory ? `${memory} GB` : ''}{!cores && !memory ? 'Details unavailable' : ''}</span>
								<span class="net"><i class:off={!online}></i>{online ? 'Online' : 'Offline'} · {sessionText}</span>
							</div>
						</div>
					{:else if w.custom}
						<iframe title={w.name} sandbox="allow-scripts" srcdoc={widgetDoc(w.html)}></iframe>
						<div class="gripbar" aria-hidden="true"></div>
						{#if widgets.editing}<div class="shield"></div>{/if}
					{/if}
				</section>
			{/if}
		{/each}
	</div>

	{#if widgets.editing}
		<div class="tray" onpointerdown={(e) => e.stopPropagation()} role="dialog" aria-label="Widget gallery" tabindex="-1">
			<div class="chips">
				{#each list as w (w.id)}
					{@const on = widgets.items[w.id]?.on}
					<button class="chip" class:on onclick={() => toggleWidget(w.id)} aria-pressed={!!on}>
						<span class="ck">
							{#if on}<svg viewBox="0 0 12 12"><path d="M2.8 6.4l2.2 2.2 4.2-4.8" /></svg>{:else}<svg viewBox="0 0 12 12"><path d="M6 2.8v6.4M2.8 6h6.4" /></svg>{/if}
						</span>
						{w.name}
					</button>
				{/each}
			</div>
			<span class="sep"></span>
			<label class="import">
				<svg viewBox="0 0 16 16"><path d="M8 2.5v8M4.8 7.4L8 10.6l3.2-3.2M3 13h10" /></svg>
				Import…
				<input type="file" accept=".html,.htm,.json,text/html,application/json" multiple hidden onchange={pickFiles} />
			</label>
			<button class="done" onclick={() => setEditing(false)}>Done</button>
		</div>
	{/if}
{/if}

<style>
	button {
		border: 0;
	}
	.layer {
		position: absolute;
		inset: 0;
		z-index: 1; /* above wallpaper + desktop icons, below every window */
		pointer-events: none;
	}
	.w {
		position: absolute;
		pointer-events: auto;
		overflow: hidden;
		border-radius: 24px;
		background: var(--glass-panel);
		backdrop-filter: var(--glass-filter);
		box-shadow: var(--glass-edge), var(--glass-drop);
		color: #fff;
		cursor: grab;
		user-select: none;
		touch-action: none;
		transition:
			scale 180ms var(--ease-out),
			box-shadow 180ms;
		animation: wpop 520ms calc(var(--i) * 70ms) var(--ease-spring) backwards;
	}
	/* a soft highlight across the top of every card */
	.w::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 0;
		border-radius: inherit;
		background: linear-gradient(160deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0) 38%);
		pointer-events: none;
	}
	.w > :global(*) {
		position: relative;
	}
	.w.drag {
		cursor: grabbing;
		scale: 1.025;
		transition: none;
		box-shadow:
			var(--glass-edge),
			0 28px 60px rgba(0, 0, 0, 0.5);
	}
	@keyframes wpop {
		from {
			opacity: 0;
			scale: 0.9;
			translate: 0 10px;
		}
	}

	/* ---------- edit mode ---------- */
	.w.edit {
		outline: 1.5px dashed rgba(255, 255, 255, 0.55);
		outline-offset: 3px;
		animation: wiggle 0.5s ease-in-out infinite alternate;
	}
	@keyframes wiggle {
		from {
			rotate: -0.5deg;
		}
		to {
			rotate: 0.5deg;
		}
	}
	.badge {
		position: absolute !important;
		top: 8px;
		left: 8px;
		z-index: 5;
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border-radius: 50%;
		background: #ff453a;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
		color: #fff;
	}
	.badge svg {
		width: 12px;
		height: 12px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
	}
	.shield {
		position: absolute !important;
		inset: 0;
		z-index: 4;
	}

	/* ---------- clock ---------- */
	.clock {
		display: grid;
		place-items: center;
		border-radius: 50%;
		background:
			radial-gradient(circle at 50% 30%, rgba(255, 255, 255, 0.1), transparent 62%),
			var(--glass-panel);
	}
	.clock svg {
		width: 100%;
		height: 100%;
	}
	.rim {
		fill: none;
		stroke: rgba(255, 255, 255, 0.1);
		stroke-width: 0.8;
	}
	.tick {
		stroke: rgba(255, 255, 255, 0.34);
		stroke-width: 0.6;
		stroke-linecap: round;
	}
	.tick.major {
		stroke: rgba(255, 255, 255, 0.95);
		stroke-width: 1.4;
	}
	.num {
		fill: rgba(255, 255, 255, 0.9);
		font-size: 8.6px;
		font-weight: 600;
		text-anchor: middle;
		font-family: var(--font-family-heading);
	}
	.plate rect {
		fill: rgba(255, 255, 255, 0.1);
	}
	.day {
		fill: rgba(255, 255, 255, 0.78);
		font-size: 5.2px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-anchor: middle;
		font-family: var(--font-family-body);
	}
	.shadow {
		filter: drop-shadow(0 1.2px 1.4px rgba(0, 0, 0, 0.55));
	}
	.hand {
		stroke: #fff;
		stroke-linecap: round;
	}
	.hand.hour {
		stroke-width: 3.6;
	}
	.hand.min {
		stroke-width: 2.5;
	}
	.hand.sec {
		stroke: var(--os-accent, #0a84ff);
		stroke-width: 1;
	}
	.pin {
		fill: var(--os-accent, #0a84ff);
	}
	.cap {
		fill: #111;
	}

	/* ---------- calendar ---------- */
	.calendar {
		padding: 14px 14px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.calendar header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		padding: 0 4px;
	}
	.when {
		display: flex;
		flex-direction: column;
		line-height: 1.15;
	}
	.wd {
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.5);
	}
	.when b {
		font-size: 20px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.yr {
		font-size: 12px;
		padding-bottom: 3px;
		color: var(--os-accent, #0a84ff);
		filter: brightness(1.3);
		font-weight: 700;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 1px 0;
		font-size: 11.5px;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}
	.grid i {
		display: grid;
		place-items: center;
		height: 25px;
		font-style: normal;
	}
	.dow {
		height: 18px !important;
		font-size: 9.5px !important;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.42);
	}
	.wk {
		color: rgba(255, 255, 255, 0.5);
	}
	.today {
		border-radius: 50%;
		background: var(--os-accent, #0a84ff);
		color: #fff !important;
		font-weight: 700;
		box-shadow: 0 3px 12px color-mix(in srgb, var(--os-accent, #0a84ff) 60%, transparent);
	}

	/* ---------- notes ---------- */
	.notes {
		display: flex;
		flex-direction: column;
		background: linear-gradient(180deg, rgba(255, 214, 10, 0.24), rgba(255, 214, 10, 0.07) 42%), var(--glass-panel);
	}
	.notesHead {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 12px 16px 4px;
		font-size: 13px;
		color: #ffd60a;
	}
	.notesHead svg {
		width: 14px;
		height: 14px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.3;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	textarea {
		flex: 1;
		min-height: 0;
		padding: 2px 16px 12px;
		resize: none;
		border: 0;
		outline: 0;
		/* ruled lines, like a legal pad */
		background: repeating-linear-gradient(transparent 0 21px, rgba(255, 255, 255, 0.09) 21px 22px);
		background-position: 0 2px;
		color: rgba(255, 255, 255, 0.94);
		font: inherit;
		font-size: 13px;
		line-height: 22px;
		cursor: text;
		user-select: text;
	}
	textarea::placeholder {
		color: rgba(255, 255, 255, 0.34);
	}

	/* ---------- now playing ---------- */
	.tint {
		position: absolute !important;
		inset: -30px;
		z-index: 0;
		background: center / cover;
		filter: blur(30px) saturate(1.8) brightness(0.7);
		opacity: 0.8;
	}
	.np {
		display: flex;
		gap: 12px;
		align-items: center;
		height: 100%;
		padding: 14px;
	}
	.art {
		flex: none;
		width: 72px;
		height: 72px;
		border-radius: 14px;
		background: #2a2a2e center / cover;
		box-shadow:
			0 8px 20px rgba(0, 0, 0, 0.45),
			inset 0 0 0 0.5px rgba(255, 255, 255, 0.22);
		transition: scale 360ms var(--ease-out);
	}
	.art.still {
		scale: 0.92;
		filter: brightness(0.8);
	}
	.meta {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
		flex: 1;
	}
	.meta b {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 13.5px;
	}
	.meta span {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 11.5px;
		color: rgba(255, 255, 255, 0.64);
	}
	.ctl {
		display: flex;
		align-items: center;
		gap: 4px;
		margin: 5px 0 0 -4px;
	}
	.ctl button {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border-radius: 50%;
		background: transparent;
		color: #fff;
	}
	.ctl button:hover {
		background: rgba(255, 255, 255, 0.18);
	}
	.ctl .pp {
		background: #fff;
		color: #000;
	}
	.ctl .pp:hover {
		background: #fff;
		scale: 1.08;
	}
	.ctl svg {
		width: 13px;
		height: 13px;
		fill: currentColor;
		stroke: currentColor;
		stroke-width: 1.4;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.line {
		position: absolute !important;
		inset: auto 14px 0;
		height: 3px;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.16);
		overflow: hidden;
	}
	.line i {
		display: block;
		height: 100%;
		background: #1ed760;
		transition: width 260ms linear;
	}
	.off .mark {
		display: grid;
		place-items: center;
		flex: none;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: #1ed760;
	}
	.mark svg {
		width: 24px;
		height: 24px;
		fill: none;
		stroke: #000;
		stroke-width: 1.6;
		stroke-linecap: round;
	}
	.link {
		align-self: flex-start;
		padding: 0;
		background: none;
		font-size: 12.5px;
		font-weight: 600;
		color: #1ed760;
	}
	.link:hover {
		text-decoration: underline;
	}

	/* ---------- system ---------- */
	.sys {
		display: flex;
		align-items: center;
		gap: 14px;
		height: 100%;
		padding: 14px 16px;
	}
	.batt {
		flex: none;
		width: 62px;
		height: 62px;
	}
	.trk {
		fill: none;
		stroke: rgba(255, 255, 255, 0.14);
		stroke-width: 5;
	}
	.val {
		fill: none;
		stroke: #30d158;
		stroke-width: 5;
		stroke-linecap: round;
		transition: stroke-dasharray 400ms var(--ease-out);
	}
	.val.low {
		stroke: #ff453a;
	}
	.pc {
		fill: #fff;
		font-size: 14px;
		font-weight: 700;
		text-anchor: middle;
		font-family: var(--font-family-heading);
	}
	.pc.dim {
		fill: rgba(255, 255, 255, 0.4);
	}
	.net {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 2px;
	}
	.net i {
		flex: none;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #30d158;
		box-shadow: 0 0 6px #30d158;
	}
	.net i.off {
		background: #ff453a;
		box-shadow: 0 0 6px #ff453a;
	}

	/* ---------- imported widgets ---------- */
	.custom iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
		background: transparent;
		z-index: 1;
	}
	.gripbar {
		position: absolute !important;
		top: 0;
		left: 0;
		right: 0;
		height: 14px;
		z-index: 3;
		cursor: grab;
	}
	.gripbar::after {
		content: '';
		position: absolute;
		top: 5px;
		left: 50%;
		width: 26px;
		height: 3px;
		translate: -50% 0;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.3);
		opacity: 0;
		transition: opacity 150ms;
	}
	.custom:hover .gripbar::after {
		opacity: 1;
	}

	/* ---------- gallery tray ---------- */
	.tray {
		position: absolute;
		left: 50%;
		bottom: calc(var(--ib, 0px) + 16px);
		translate: -50% 0;
		z-index: 9200;
		display: flex;
		align-items: center;
		gap: 10px;
		max-width: calc(100vw - 24px);
		padding: 10px 12px;
		border-radius: 20px;
		background: var(--glass-panel);
		backdrop-filter: var(--glass-filter);
		box-shadow: var(--glass-edge), 0 20px 50px rgba(0, 0, 0, 0.5);
		color: #fff;
		animation: rise 260ms var(--ease-out);
	}
	@keyframes rise {
		from {
			opacity: 0;
			translate: -50% 14px;
		}
	}
	.chips {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		min-width: 0;
	}
	.chip,
	.import,
	.done {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		flex: none;
		height: 32px;
		padding: 0 14px 0 8px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.1);
		font-size: 12.5px;
		font-weight: 600;
		color: #fff;
		cursor: pointer;
		transition: background 120ms;
	}
	.chip:hover,
	.import:hover {
		background: rgba(255, 255, 255, 0.2);
	}
	.chip.on {
		background: color-mix(in srgb, var(--os-accent, #0a84ff) 55%, rgba(255, 255, 255, 0.08));
	}
	.ck {
		display: grid;
		place-items: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.18);
	}
	.chip.on .ck {
		background: #fff;
		color: #000;
	}
	.ck svg,
	.import svg {
		width: 11px;
		height: 11px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.7;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.import {
		padding: 0 14px;
	}
	.import svg {
		width: 14px;
		height: 14px;
		stroke-width: 1.4;
	}
	.sep {
		flex: none;
		width: 1px;
		height: 22px;
		background: rgba(255, 255, 255, 0.2);
	}
	.done {
		padding: 0 18px;
		background: #fff;
		color: #000;
	}
	.done:hover {
		background: #fff;
		scale: 1.04;
	}
</style>
