<script>
	// Spotify sends the browser back here after login. Swap the code for tokens, then close the
	// popup (or go back to the desktop if the login happened in the main tab).
	import { onMount } from 'svelte';
	import '$lib/style/variables.css';
	import { completeAuth } from '$lib/os/spotify.svelte.js';

	let authStatus = $state('working'); // working | done | error
	let message = $state('');

	onMount(async () => {
		const q = new URLSearchParams(location.search);
		if (q.get('error')) {
			authStatus = 'error';
			message = q.get('error') === 'access_denied' ? 'You chose not to connect Spotify.' : `Spotify said: ${q.get('error')}`;
			return;
		}
		try {
			await completeAuth(q.get('code'), q.get('state'));
			authStatus = 'done';
			if (window.opener) setTimeout(() => window.close(), 900);
			else setTimeout(() => location.replace('/os'), 900);
		} catch (e) {
			authStatus = 'error';
			message = e instanceof Error ? e.message : String(e);
		}
	});
</script>

<svelte:head><title>Connecting Spotify…</title></svelte:head>

<main>
	<div class="card">
		{#if authStatus === 'working'}
			<span class="spin"></span>
			<h1>Connecting to Spotify…</h1>
		{:else if authStatus === 'done'}
			<span class="ok"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg></span>
			<h1>Spotify connected</h1>
			<p>You can close this window.</p>
		{:else}
			<span class="bad">!</span>
			<h1>Couldn’t connect</h1>
			<p>{message}</p>
			<a href="/os">Back to desktop</a>
		{/if}
	</div>
</main>

<style>
	:global(html, body) {
		margin: 0;
		height: 100%;
		background: #0b0b0d;
	}
	main {
		display: grid;
		place-items: center;
		height: 100vh;
		color: #fff;
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		max-width: 340px;
		padding: 36px 32px;
		text-align: center;
		border-radius: 22px;
		background: rgba(255, 255, 255, 0.06);
		box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.18);
	}
	h1 {
		margin: 8px 0 0;
		font-size: 18px;
	}
	p {
		margin: 0;
		font-size: 13.5px;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.7);
	}
	a {
		margin-top: 8px;
		color: #1ed760;
		font-size: 13.5px;
	}
	.spin,
	.ok,
	.bad {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
	}
	.spin {
		border: 3px solid rgba(255, 255, 255, 0.18);
		border-top-color: #1ed760;
		animation: spin 0.8s linear infinite;
	}
	.ok {
		background: #1ed760;
	}
	.ok svg {
		width: 22px;
		height: 22px;
		fill: none;
		stroke: #000;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.bad {
		background: #ff453a;
		font-size: 24px;
		font-weight: 700;
	}
	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}
</style>
