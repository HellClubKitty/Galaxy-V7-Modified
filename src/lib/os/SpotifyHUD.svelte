<script>
	// The Spotify HUD: a banner when the song changes, and a panel that drops from the menu bar with
	// three tabs: Playing (art, scrubber, controls, volume), Up next (the queue) and Devices.
	import { untrack } from 'svelte';
	import { prefs } from './prefs.svelte.js';
	import { sp, control, seek, setVolume, toggleShuffle, cycleRepeat, loadQueue, loadDevices, transfer } from './spotify.svelte.js';
	import { toast } from './wm.svelte.js';
	import EqBars from './EqBars.svelte';
	import Marquee from './Marquee.svelte';

	let { open = false, onopen, onclose, onsettings } = $props();

	let tab = $state('playing');
	const TABS = [
		['playing', 'Playing'],
		['queue', 'Up next'],
		['devices', 'Devices']
	];

	/* ---------- banner on track change ---------- */
	let banner = $state(/** @type {({ key: number, leaving: boolean } & NonNullable<typeof sp.track>) | null} */ (null));
	let bannerTimer;
	let leaveTimer;
	let seen = untrack(() => sp.changeSeq);
	$effect(() => {
		const seq = sp.changeSeq;
		if (seq === seen) return;
		seen = seq;
		const track = sp.track;
		if (!prefs.spotifyHud || !prefs.spotifyBanner || !track) return;
		untrack(() => {
			if (open) return;
			banner = { ...track, key: seq, leaving: false };
			clearTimeout(bannerTimer);
			clearTimeout(leaveTimer);
			leaveTimer = setTimeout(() => banner && (banner.leaving = true), 3800);
			bannerTimer = setTimeout(() => (banner = null), 4200);
		});
	});
	$effect(() => {
		if (open) banner = null;
	});

	/* ---------- queue + devices load when their tab is showing ---------- */
	$effect(() => {
		if (!open || !sp.connected) return;
		sp.track?.id; // reload the queue when the song changes
		const showing = tab;
		untrack(() => {
			if (showing === 'queue') loadQueue();
			if (showing === 'devices') loadDevices();
		});
	});
	$effect(() => {
		if (!open || tab !== 'devices') return;
		const t = setInterval(loadDevices, 6000);
		return () => clearInterval(t);
	});

	/* ---------- scrubber ---------- */
	let scrubbing = $state(false);
	let scrubRatio = $state(0);
	let trackEl = $state();
	const ratio = $derived(scrubbing ? scrubRatio : sp.duration ? Math.min(1, sp.progress / sp.duration) : 0);
	const fmt = (ms) => {
		const s = Math.max(0, Math.floor(ms / 1000));
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	};
	const at = (e) => {
		const r = trackEl.getBoundingClientRect();
		return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
	};
	function sdown(e) {
		if (!sp.duration) return;
		trackEl.setPointerCapture(e.pointerId);
		scrubbing = true;
		scrubRatio = at(e);
	}
	const smove = (e) => scrubbing && (scrubRatio = at(e));
	function sup(e) {
		if (!scrubbing) return;
		scrubbing = false;
		trackEl.releasePointerCapture?.(e.pointerId);
		seek(at(e) * sp.duration);
	}

	/* ---------- actions ---------- */
	const say = (r) => r?.message && toast(r.message);
	const act = async (action) => say(await control(action));
	let volTimer;
	function vol(e) {
		const v = Number(e.currentTarget.value);
		sp.volume = v;
		clearTimeout(volTimer);
		volTimer = setTimeout(async () => say(await setVolume(v)), 160);
	}

	/* ---------- keyboard (only while the panel is open) ---------- */
	function key(e) {
		if (!open || !sp.track || e.target.closest?.('input, textarea')) return;
		if (e.code === 'Space') (e.preventDefault(), act(sp.isPlaying ? 'pause' : 'play'));
		else if (e.key === 'ArrowRight') (e.preventDefault(), seek(Math.min(sp.duration, sp.progress + 10000)));
		else if (e.key === 'ArrowLeft') (e.preventDefault(), seek(Math.max(0, sp.progress - 10000)));
		else if (e.key === 'ArrowUp' && sp.volumeOk) (e.preventDefault(), setVolume((sp.volume ?? 0) + 5));
		else if (e.key === 'ArrowDown' && sp.volumeOk) (e.preventDefault(), setVolume((sp.volume ?? 0) - 5));
	}

	const deviceIcon = { Computer: 'M3 4.5h10v6.5H3zM1.8 13h12.4', Smartphone: 'M5 2h6v12H5zM7.4 12.2h1.2', Speaker: 'M4.5 2h7v12h-7zM8 6.2a.6.6 0 1 0 0 .01M8 10.6a1.8 1.8 0 1 0 0 .01' };
</script>

<svelte:window onkeydown={key} />

{#if banner && !open}
	{#key banner.key}
		<button class="banner" class:leaving={banner.leaving} onclick={onopen} aria-label="Open Spotify panel">
			<span class="bart" style:background-image={banner.art ? `url(${banner.art})` : null}></span>
			<span class="btxt">
				<b>{banner.name}</b>
				<em>{banner.artist}</em>
			</span>
			<EqBars color="#1ed760" />
		</button>
	{/key}
{/if}

{#if open}
	<div class="panel" onpointerdown={(e) => e.stopPropagation()} role="dialog" aria-label="Spotify" tabindex="-1">
		{#if sp.track}
			<div class="ambient" style:background-image={sp.track.art ? `url(${sp.track.art})` : null}></div>
		{/if}

		<div class="top">
			<div class="tabs" role="tablist">
				{#each TABS as [id, label]}
					<button role="tab" aria-selected={tab === id} class:on={tab === id} onclick={() => (tab = id)}>{label}</button>
				{/each}
			</div>
			<button class="x" aria-label="Close" onclick={onclose}>
				<svg viewBox="0 0 12 12"><path d="M3.3 3.3l5.4 5.4M8.7 3.3L3.3 8.7" /></svg>
			</button>
		</div>

		{#if !sp.connected}
			<div class="empty">
				<span class="big"><svg viewBox="0 0 16 16"><path d="M2.6 5.6c3.5-1.1 7.6-.8 10.8 1M3.2 8.4c3-.9 6.4-.6 9.2.9M3.8 11c2.5-.6 5-.4 7.2.8" /></svg></span>
				<h3>Show what’s playing</h3>
				<p>Connect your Spotify account to see the current song here, on the menu bar and in widgets. You can also control playback, volume and devices.</p>
				<button class="cta" onclick={onsettings}>Set up Spotify…</button>
			</div>
		{:else if tab === 'playing'}
			{#if !sp.track}
				<div class="empty">
					<span class="big dim"><svg viewBox="0 0 16 16"><path d="M2.6 5.6c3.5-1.1 7.6-.8 10.8 1M3.2 8.4c3-.9 6.4-.6 9.2.9M3.8 11c2.5-.6 5-.4 7.2.8" /></svg></span>
					<h3>{sp.status === 'error' ? 'Spotify isn’t responding' : 'Nothing playing'}</h3>
					<p>{sp.error || 'Press play in Spotify on any device and it will show up here.'}</p>
				</div>
			{:else}
				<div class="stage">
					{#key sp.track.id}
						<div class="glow" style:background-image={sp.track.art ? `url(${sp.track.art})` : null}></div>
						<div class="art" class:paused={!sp.isPlaying} style:background-image={sp.track.art ? `url(${sp.track.art})` : null}></div>
					{/key}
				</div>

				<div class="titles">
					<div class="lines">
						<Marquee text={sp.track.name} size={19} weight={700} />
						<Marquee text={sp.track.artist} size={14} weight={500} color="rgba(255,255,255,0.7)" />
					</div>
					{#if sp.track.url}
						<a class="open" href={sp.track.url} target="_blank" rel="noreferrer" aria-label="Open in Spotify" title="Open in Spotify">
							<svg viewBox="0 0 16 16"><path d="M6 3H3.5v9.5H13V10M9 3h4v4M13 3L7.5 8.5" /></svg>
						</a>
					{/if}
				</div>

				<div class="scrub">
					<div
						class="track"
						class:on={scrubbing}
						bind:this={trackEl}
						onpointerdown={sdown}
						onpointermove={smove}
						onpointerup={sup}
						onpointercancel={sup}
						role="slider"
						tabindex="0"
						aria-label="Seek"
						aria-valuemin="0"
						aria-valuemax={sp.duration}
						aria-valuenow={sp.progress}
					>
						<i style:width="{ratio * 100}%"></i>
						<b class="knob" style:left="{ratio * 100}%"></b>
					</div>
					<div class="times">
						<span>{fmt(scrubbing ? scrubRatio * sp.duration : sp.progress)}</span>
						<span>-{fmt(sp.duration - (scrubbing ? scrubRatio * sp.duration : sp.progress))}</span>
					</div>
				</div>

				<div class="controls">
					<button class="side" class:on={sp.shuffle} aria-label="Shuffle" aria-pressed={sp.shuffle} title="Shuffle" onclick={async () => say(await toggleShuffle())}>
						<svg viewBox="0 0 16 16"><path d="M2 4.5h2.2c1.6 0 2.4 1 3.3 3 .9 2 1.7 3 3.3 3H13M2 11.5h2.2c.9 0 1.5-.3 2-.8M13 4.5h-2.2c-.9 0-1.5.3-2 .8M11.5 3L13.2 4.5 11.5 6M11.5 9.5l1.7 1.5-1.7 1.5" /></svg>
					</button>
					<button aria-label="Previous" onclick={() => act('prev')}>
						<svg class="fill" viewBox="0 0 16 16"><path d="M4 3v10M13 3.2v9.6L6.2 8z" /></svg>
					</button>
					<button class="play" aria-label={sp.isPlaying ? 'Pause' : 'Play'} onclick={() => act(sp.isPlaying ? 'pause' : 'play')}>
						{#if sp.isPlaying}
							<svg class="fill" viewBox="0 0 16 16"><path d="M4.5 3h2.6v10H4.5zM8.9 3h2.6v10H8.9z" /></svg>
						{:else}
							<svg class="fill" viewBox="0 0 16 16"><path d="M5 2.8l8.2 5.2L5 13.2z" /></svg>
						{/if}
					</button>
					<button aria-label="Next" onclick={() => act('next')}>
						<svg class="fill" viewBox="0 0 16 16"><path d="M12 3v10M3 3.2v9.6L9.8 8z" /></svg>
					</button>
					<button class="side" class:on={sp.repeat !== 'off'} aria-label="Repeat: {sp.repeat}" title="Repeat: {sp.repeat}" onclick={async () => say(await cycleRepeat())}>
						<svg viewBox="0 0 16 16"><path d="M3 7.5V6.2A1.7 1.7 0 0 1 4.7 4.5H12M10 2.5l2 2-2 2M13 8.5v1.3a1.7 1.7 0 0 1-1.7 1.7H4M6 13.5l-2-2 2-2" /></svg>
						{#if sp.repeat === 'track'}<i class="one">1</i>{/if}
					</button>
				</div>

				<div class="vol" class:off={!sp.volumeOk}>
					<svg viewBox="0 0 16 16"><path d="M2.5 6.2h2.2L8 3.4v9.2L4.7 9.8H2.5z" /></svg>
					<input type="range" min="0" max="100" value={sp.volume ?? 0} disabled={!sp.volumeOk} oninput={vol} aria-label="Volume" style:--v="{sp.volume ?? 0}%" />
					<svg viewBox="0 0 16 16"><path d="M2.5 6.2h2.2L8 3.4v9.2L4.7 9.8H2.5zM10.4 5.8a3.2 3.2 0 0 1 0 4.4M12 4a5.6 5.6 0 0 1 0 8" /></svg>
				</div>
				<p class="meta">
					{[sp.device && `Playing on ${sp.device}`, sp.track.album].filter(Boolean).join(' · ')}
				</p>
				{#if sp.error}<p class="err">{sp.error}</p>{/if}
			{/if}
		{:else if tab === 'queue'}
			<div class="list">
				{#if sp.queue.length}
					{#each sp.queue as t, i (t.id + i)}
						<div class="item">
							<span class="th" style:background-image={t.art ? `url(${t.art})` : null}></span>
							<span class="tx"><b>{t.name}</b><em>{t.artist}</em></span>
						</div>
					{/each}
				{:else}
					<p class="blank">Nothing queued. Spotify fills this in from the album or playlist that’s playing.</p>
				{/if}
			</div>
		{:else}
			<div class="list">
				{#if sp.devices.length}
					{#each sp.devices as d (d.id)}
						<button class="item dev" class:active={d.active} onclick={async () => say(await transfer(d.id))}>
							<span class="ic"><svg viewBox="0 0 16 16"><path d={deviceIcon[d.type] ?? deviceIcon.Speaker} /></svg></span>
							<span class="tx"><b>{d.name}</b><em>{d.active ? 'Playing here' : d.type}</em></span>
							{#if d.active}<EqBars playing={sp.isPlaying} color="#1ed760" />{/if}
						</button>
					{/each}
					<p class="blank small">Pick a device to move playback to it.</p>
				{:else}
					<p class="blank">No devices found. Open Spotify on a phone or computer and it will appear here.</p>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	button {
		border: 0;
	}
	/* ---------- banner ---------- */
	.banner {
		position: absolute;
		top: 36px;
		right: 10px;
		z-index: 9350;
		display: flex;
		align-items: center;
		gap: 10px;
		width: 292px;
		padding: 8px 14px 8px 8px;
		border-radius: 16px;
		background: var(--glass-panel);
		backdrop-filter: var(--glass-filter);
		box-shadow: var(--glass-edge), var(--glass-drop);
		color: #fff;
		text-align: left;
		animation: banner-in 320ms var(--ease-out) backwards;
		transition:
			opacity 300ms,
			translate 300ms;
	}
	.banner.leaving {
		opacity: 0;
		translate: 12px 0;
	}
	@keyframes banner-in {
		from {
			opacity: 0;
			translate: 24px 0;
			scale: 0.96;
		}
	}
	.bart {
		flex: none;
		width: 40px;
		height: 40px;
		border-radius: 9px;
		background: #2a2a2e center / cover;
		box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.2);
	}
	.btxt {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}
	.btxt b,
	.btxt em {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.btxt b {
		font-size: 13px;
	}
	.btxt em {
		font-style: normal;
		font-size: 11.5px;
		color: rgba(255, 255, 255, 0.62);
	}

	/* ---------- panel ---------- */
	.panel {
		position: absolute;
		top: 34px;
		right: 8px;
		z-index: 9400;
		width: 364px;
		max-width: calc(100vw - 16px);
		max-height: calc(100vh - 48px);
		overflow-y: auto;
		padding: 12px 18px 18px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		border-radius: 28px;
		background: var(--glass-panel);
		backdrop-filter: var(--glass-filter);
		box-shadow: var(--glass-edge), 0 28px 70px rgba(0, 0, 0, 0.55);
		color: #fff;
		scrollbar-width: none;
		animation: drop 240ms var(--ease-out);
	}
	.panel::-webkit-scrollbar {
		display: none;
	}
	@keyframes drop {
		from {
			opacity: 0;
			translate: 0 -8px;
			scale: 0.97;
		}
	}
	/* the cover art, blown up and blurred, tints the whole panel */
	.ambient {
		position: fixed;
		inset: -60px;
		z-index: -1;
		background: center / cover;
		filter: blur(50px) saturate(1.8) brightness(0.78);
		opacity: 0.75;
		scale: 1.3;
		pointer-events: none;
	}
	.top {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.tabs {
		display: flex;
		flex: 1;
		padding: 3px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.28);
		box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.1);
	}
	.tabs button {
		flex: 1;
		height: 26px;
		border-radius: 999px;
		background: transparent;
		font-size: 12px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.62);
		transition:
			background 160ms,
			color 160ms;
	}
	.tabs button:hover {
		color: #fff;
	}
	.tabs button.on {
		background: rgba(255, 255, 255, 0.2);
		color: #fff;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
	}
	.x {
		display: grid;
		place-items: center;
		flex: none;
		width: 26px;
		height: 26px;
		padding: 0;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
	}
	.x:hover {
		background: rgba(255, 255, 255, 0.24);
	}
	.x svg {
		width: 11px;
		height: 11px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
	}

	/* ---------- playing ---------- */
	.stage {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		margin-top: 2px;
	}
	.glow {
		position: absolute;
		inset: 10% 6% -4%;
		border-radius: 24px;
		background: center / cover;
		filter: blur(26px) saturate(1.6);
		opacity: 0.7;
		animation: fadein 500ms;
	}
	.art {
		position: relative;
		width: 100%;
		height: 100%;
		border-radius: 22px;
		background: #2a2a2e center / cover;
		box-shadow:
			0 20px 44px rgba(0, 0, 0, 0.5),
			inset 0 0 0 0.5px rgba(255, 255, 255, 0.22);
		transition:
			scale 420ms var(--ease-out),
			filter 420ms;
		animation: fadein 500ms;
	}
	.art.paused {
		scale: 0.93;
		filter: brightness(0.72);
	}
	@keyframes fadein {
		from {
			opacity: 0;
		}
	}
	.titles {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.lines {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
		flex: 1;
	}
	.open {
		display: grid;
		place-items: center;
		flex: none;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.14);
		color: #fff;
	}
	.open:hover {
		background: rgba(255, 255, 255, 0.26);
	}
	.open svg {
		width: 15px;
		height: 15px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.scrub {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.track {
		position: relative;
		height: 16px;
		display: flex;
		align-items: center;
		cursor: pointer;
		touch-action: none;
	}
	.track::before {
		content: '';
		position: absolute;
		inset: 6px 0;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.24);
		transition: inset 120ms;
	}
	.track:hover::before,
	.track.on::before {
		inset: 5px 0;
	}
	.track i {
		position: relative;
		display: block;
		height: 4px;
		border-radius: 4px;
		background: #fff;
		transition: height 120ms;
	}
	.track:hover i,
	.track.on i {
		height: 6px;
		background: #1ed760;
		box-shadow: 0 0 12px rgba(30, 215, 96, 0.6);
	}
	.knob {
		position: absolute;
		top: 50%;
		width: 12px;
		height: 12px;
		translate: -50% -50%;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
		scale: 0;
		transition: scale 120ms;
	}
	.track:hover .knob,
	.track.on .knob {
		scale: 1;
	}
	.times {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		color: rgba(255, 255, 255, 0.58);
	}

	.controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 2px;
	}
	.controls button {
		position: relative;
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		padding: 0;
		border-radius: 50%;
		background: transparent;
		color: #fff;
		transition:
			background 120ms,
			scale 120ms,
			color 120ms;
	}
	.controls button:hover {
		background: rgba(255, 255, 255, 0.14);
	}
	.controls button:active {
		scale: 0.9;
	}
	.controls svg {
		width: 20px;
		height: 20px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.3;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.controls svg.fill {
		fill: currentColor;
	}
	.controls .side {
		width: 36px;
		height: 36px;
		color: rgba(255, 255, 255, 0.5);
	}
	.controls .side svg {
		width: 17px;
		height: 17px;
	}
	.controls .side.on {
		color: #1ed760;
	}
	.controls .side.on::after {
		content: '';
		position: absolute;
		bottom: 3px;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: currentColor;
	}
	.one {
		position: absolute;
		top: 3px;
		right: 5px;
		font-size: 9px;
		font-weight: 800;
		font-style: normal;
	}
	.controls .play {
		width: 58px;
		height: 58px;
		background: #fff;
		color: #000;
		box-shadow: 0 8px 22px rgba(0, 0, 0, 0.4);
	}
	.controls .play:hover {
		background: #fff;
		scale: 1.06;
	}
	.controls .play:active {
		scale: 0.95;
	}
	.controls .play svg {
		width: 23px;
		height: 23px;
	}

	.vol {
		display: flex;
		align-items: center;
		gap: 10px;
		color: rgba(255, 255, 255, 0.62);
	}
	.vol.off {
		opacity: 0.4;
	}
	.vol svg {
		flex: none;
		width: 16px;
		height: 16px;
		fill: currentColor;
		stroke: currentColor;
		stroke-width: 1.2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.vol svg:last-child {
		fill: none;
	}
	.vol input {
		flex: 1;
		height: 18px;
		appearance: none;
		background: transparent;
		cursor: pointer;
	}
	.vol input::-webkit-slider-runnable-track {
		height: 4px;
		border-radius: 4px;
		background: linear-gradient(90deg, #fff var(--v), rgba(255, 255, 255, 0.24) var(--v));
	}
	.vol input::-moz-range-track {
		height: 4px;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.24);
	}
	.vol input::-moz-range-progress {
		height: 4px;
		border-radius: 4px;
		background: #fff;
	}
	.vol input::-webkit-slider-thumb {
		appearance: none;
		width: 12px;
		height: 12px;
		margin-top: -4px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 1px 5px rgba(0, 0, 0, 0.4);
	}
	.vol input::-moz-range-thumb {
		width: 12px;
		height: 12px;
		border: 0;
		border-radius: 50%;
		background: #fff;
	}
	.meta {
		margin: -4px 0 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		text-align: center;
		font-size: 11.5px;
		color: rgba(255, 255, 255, 0.5);
	}
	.err {
		margin: 0;
		font-size: 12px;
		line-height: 1.4;
		color: #ff8a80;
		text-align: center;
	}

	/* ---------- lists ---------- */
	.list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-height: 200px;
	}
	.item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 7px 8px;
		border-radius: 12px;
		background: transparent;
		color: #fff;
		text-align: left;
	}
	button.item:hover {
		background: rgba(255, 255, 255, 0.12);
	}
	.item.active {
		background: rgba(30, 215, 96, 0.16);
	}
	.th {
		flex: none;
		width: 42px;
		height: 42px;
		border-radius: 8px;
		background: #2a2a2e center / cover;
		box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.16);
	}
	.ic {
		display: grid;
		place-items: center;
		flex: none;
		width: 42px;
		height: 42px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.12);
	}
	.item.active .ic {
		background: #1ed760;
		color: #000;
	}
	.ic svg {
		width: 19px;
		height: 19px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.3;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.tx {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}
	.tx b,
	.tx em {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.tx b {
		font-size: 13.5px;
	}
	.tx em {
		font-style: normal;
		font-size: 11.5px;
		color: rgba(255, 255, 255, 0.58);
	}
	.blank {
		margin: 40px 14px;
		text-align: center;
		font-size: 13px;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.6);
	}
	.blank.small {
		margin: 12px 14px 0;
		font-size: 11.5px;
	}

	/* ---------- empty states ---------- */
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 18px 8px 8px;
		text-align: center;
	}
	.big {
		display: grid;
		place-items: center;
		width: 68px;
		height: 68px;
		border-radius: 50%;
		background: #1ed760;
		box-shadow: 0 10px 28px rgba(30, 215, 96, 0.35);
	}
	.big.dim {
		background: rgba(255, 255, 255, 0.14);
		box-shadow: none;
	}
	.big svg {
		width: 36px;
		height: 36px;
		fill: none;
		stroke: #000;
		stroke-width: 1.5;
		stroke-linecap: round;
	}
	.big.dim svg {
		stroke: #fff;
	}
	.empty h3 {
		margin: 6px 0 0;
		font-size: 16px;
	}
	.empty p {
		margin: 0;
		font-size: 13px;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.64);
	}
	.cta {
		margin-top: 8px;
		height: 36px;
		padding: 0 20px;
		border-radius: 999px;
		background: #1ed760;
		font-size: 13.5px;
		font-weight: 700;
		color: #000;
	}
	.cta:hover {
		filter: brightness(1.08);
	}
</style>
