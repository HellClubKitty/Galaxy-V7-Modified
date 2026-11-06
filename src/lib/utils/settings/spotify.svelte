<script>
	import '$lib/style/settings.css';
	import { onMount } from 'svelte';
	import { prefs, setPref, initPrefs } from '$lib/os/prefs.svelte.js';
	import { sp, spConfig, setClientId, startAuth, disconnect, redirectUri, initSpotify } from '$lib/os/spotify.svelte.js';

	let error = $state('');
	let copied = $state(false);
	let host = $state('');
	let secure = $state(true);

	onMount(() => {
		host = location.hostname;
		secure = !!crypto?.subtle;
		// Only read the login state here; the desktop is the one that polls Spotify.
		const offs = [initPrefs(), initSpotify({ poll: false })];
		return () => offs.forEach((off) => off());
	});

	const uri = $derived(redirectUri());
	const wrongHost = $derived(host === 'localhost');
	const insecure = $derived(!!host && !wrongHost && !secure);

	async function connect() {
		error = '';
		try {
			await startAuth();
		} catch (e) {
			error = e.message;
		}
	}
	async function copy() {
		try {
			await navigator.clipboard.writeText(uri);
			copied = true;
			setTimeout(() => (copied = false), 1400);
		} catch {}
	}
</script>

<div class="group">
	<div class="subGroup">
		<p class="subHeading">Account</p>
		{#if sp.connected}
			<p class="desc status ok">Connected. Whatever you play on any device shows up on the menu bar, in the Spotify panel and in the Now Playing widget.</p>
			<div class="content">
				<button class="actionBtn" onclick={disconnect}>Disconnect</button>
			</div>
		{:else}
			<p class="desc">Spotify can’t be read from inside the Spotify window, so this connects to your account directly. It takes about two minutes, once.</p>
			<ol class="steps">
				<li>Open the <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">Spotify developer dashboard</a> and create an app. Pick <b>Web API</b>.</li>
				<li>Add the redirect address below to the app, exactly as shown.</li>
				<li>Copy the app’s <b>Client ID</b> into the box and press Connect.</li>
			</ol>

			<p class="label">Redirect address</p>
			<div class="copy">
				<code>{uri}</code>
				<button class="actionBtn" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
			</div>
			{#if wrongHost}
				<p class="desc warn">Spotify doesn’t accept <code>localhost</code>. Open this site at <code>http://127.0.0.1:{location.port || 80}</code> instead, then use that address here.</p>
			{:else if insecure}
				<p class="desc warn">Spotify login needs <code>https://</code> (or <code>http://127.0.0.1</code>). This address is plain http.</p>
			{/if}

			<p class="label">Client ID</p>
			<input class="textInput" placeholder="Paste your Client ID" spellcheck="false" autocomplete="off" value={spConfig.clientId} oninput={(e) => setClientId(e.currentTarget.value.trim())} />
			<div class="content">
				<button class="actionBtn" disabled={!spConfig.clientId.trim()} onclick={connect}>Connect Spotify</button>
			</div>
			{#if error}<p class="desc warn">{error}</p>{/if}
		{/if}
	</div>

	<div class="subGroup">
		<p class="subHeading">HUD</p>
		<div class="content">
			<button class="toggleBtn" class:active={prefs.spotifyHud} onclick={() => setPref('spotifyHud', !prefs.spotifyHud)}>Menu bar now playing</button>
			<button class="toggleBtn" class:active={prefs.spotifyBanner} onclick={() => setPref('spotifyBanner', !prefs.spotifyBanner)}>Banner on song change</button>
		</div>
		<p class="desc">Turn on the Now Playing widget under Desktop &amp; Dock → Widgets.</p>
		<p class="subHeading gap">Good to know</p>
		<p class="desc">Pause, skip and scrub need Spotify Premium. Spotify also limits new apps in Development Mode: the app’s owner needs Premium, and anyone else must be added under User Management in the dashboard.</p>
	</div>
</div>

<style>
	.steps {
		margin: 12px 0 0;
		padding-left: 20px;
		font-size: 13px;
		line-height: 1.6;
		color: var(--color-text-muted);
	}
	.steps a {
		color: var(--color-text);
	}
	.label {
		margin: 18px 0 0;
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-muted);
	}
	.copy {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 8px;
	}
	.copy code {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 9px 12px;
		border-radius: var(--radius-control);
		font-size: 12.5px;
	}
	.warn {
		color: #ff9f0a;
	}
	.status.ok {
		color: #30d158;
	}
	.gap {
		margin-top: 22px;
	}
</style>
