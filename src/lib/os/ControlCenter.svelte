<script>
	import { prefs, setPref, accents } from './prefs.svelte.js';
	import { sp } from './spotify.svelte.js';
	import EqBars from './EqBars.svelte';

	let { isFullscreen, hasWindows, onfullscreen, onsettings, onchangelog, onshowdesktop, onclosewindows, onlock, onspotify } = $props();
</script>

<div class="cc" onpointerdown={(e) => e.stopPropagation()} role="dialog" aria-label="Control Center" tabindex="-1">
	<div class="tiles">
		<button class="tile" onclick={onsettings}>
			<span class="ic"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.2" /><path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3" /></svg></span>
			<span>Settings</span>
		</button>
		<button class="tile" class:on={isFullscreen} onclick={onfullscreen}>
			<span class="ic"><svg viewBox="0 0 16 16"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" /></svg></span>
			<span>Fullscreen</span>
		</button>
		<button class="tile" onclick={onshowdesktop}>
			<span class="ic"><svg viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="8.5" rx="1.4" /><path d="M5.5 14h5" /></svg></span>
			<span>Show desktop</span>
		</button>
		<button class="tile" onclick={onlock}>
			<span class="ic"><svg viewBox="0 0 16 16"><rect x="3.2" y="7" width="9.6" height="6.8" rx="1.6" /><path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" /></svg></span>
			<span>Lock</span>
		</button>
	</div>

	<button class="now" onclick={onspotify}>
		{#if sp.connected && sp.track}
			<span class="art" style:background-image={sp.track.art ? `url(${sp.track.art})` : null}></span>
			<span class="txt">
				<b>{sp.track.name}</b>
				<em>{sp.track.artist}</em>
			</span>
			<EqBars playing={sp.isPlaying} color="#1ed760" />
		{:else}
			<span class="art green"><svg viewBox="0 0 16 16"><path d="M2.6 5.6c3.5-1.1 7.6-.8 10.8 1M3.2 8.4c3-.9 6.4-.6 9.2.9M3.8 11c2.5-.6 5-.4 7.2.8" /></svg></span>
			<span class="txt">
				<b>Spotify</b>
				<em>{sp.connected ? 'Nothing playing' : 'Show what’s playing…'}</em>
			</span>
		{/if}
	</button>

	<div class="card">
		<div class="row">
			<span class="cap">Dock size</span>
			<input type="range" min="36" max="76" step="2" value={prefs.dockSize} oninput={(e) => setPref('dockSize', Number(e.currentTarget.value))} />
		</div>
		<div class="row">
			<span class="cap">Magnification</span>
			<input type="range" min="1" max="2.2" step="0.1" disabled={!prefs.magnify} value={prefs.magnifyAmount} oninput={(e) => setPref('magnifyAmount', Number(e.currentTarget.value))} />
		</div>
	</div>

	<div class="card">
		<span class="cap">Accent</span>
		<div class="swatches">
			{#each accents as [name, value]}
				<button class="sw" class:on={prefs.accent === value} style:background={value} aria-label={name} title={name} onclick={() => setPref('accent', value)}></button>
			{/each}
		</div>
	</div>

	{#if hasWindows}
		<button class="wide" onclick={onclosewindows}>Close all windows</button>
	{/if}
	<button class="wide soft" onclick={onchangelog}>What’s new</button>
</div>

<style>
	.cc {
		position: absolute;
		top: 34px;
		right: 8px;
		z-index: 9400;
		width: 330px;
		max-width: calc(100vw - 16px);
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		border-radius: 18px;
		background: var(--glass-panel, rgba(40, 40, 44, 0.72));
		backdrop-filter: var(--glass-filter, blur(40px) saturate(1.9));
		box-shadow: var(--glass-edge, inset 0 0 0 0.5px rgba(255, 255, 255, 0.24)), 0 22px 56px rgba(0, 0, 0, 0.45);
		color: #fff;
		animation: drop 180ms var(--ease-out);
	}
	@keyframes drop {
		from {
			opacity: 0;
			translate: 0 -8px;
			scale: 0.97;
		}
	}
	.tiles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.tile {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 56px;
		padding: 0 12px;
		border: 0;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.1);
		box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.12);
		font-size: 12.5px;
		font-weight: 600;
		color: #fff;
		transition: background var(--dur-fast);
	}
	.tile:hover {
		background: rgba(255, 255, 255, 0.18);
	}
	.ic {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.16);
	}
	.tile.on .ic {
		background: var(--os-accent, #0a84ff);
	}
	.ic svg {
		width: 15px;
		height: 15px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.now {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px 10px 10px;
		border: 0;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.1);
		box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.12);
		color: #fff;
		text-align: left;
		transition: background var(--dur-fast);
	}
	.now:hover {
		background: rgba(255, 255, 255, 0.18);
	}
	.now .art {
		flex: none;
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		border-radius: 9px;
		background: #2a2a2e center / cover;
		box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.18);
	}
	.now .art.green {
		border-radius: 50%;
		background: #1ed760;
	}
	.now .art svg {
		width: 22px;
		height: 22px;
		fill: none;
		stroke: #000;
		stroke-width: 1.6;
		stroke-linecap: round;
	}
	.now .txt {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}
	.now b,
	.now em {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.now b {
		font-size: 13px;
	}
	.now em {
		font-style: normal;
		font-size: 11.5px;
		color: rgba(255, 255, 255, 0.6);
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px 14px;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.1);
		box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.12);
	}
	.row {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.cap {
		font-size: 12px;
		font-weight: 600;
	}
	input[type='range'] {
		width: 100%;
		accent-color: var(--os-accent, #0a84ff);
	}
	.swatches {
		display: flex;
		gap: 10px;
	}
	.sw {
		width: 22px;
		height: 22px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
	}
	.sw.on {
		outline: 2px solid #fff;
		outline-offset: 2px;
	}
	.wide {
		height: 32px;
		border: 0;
		border-radius: 10px;
		background: transparent;
		font-size: 13px;
		color: #ff6961;
	}
	.wide.soft {
		color: rgba(255, 255, 255, 0.8);
	}
	.wide:hover {
		background: rgba(255, 255, 255, 0.1);
	}
</style>
