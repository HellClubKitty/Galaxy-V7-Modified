<script>
	import { onMount } from 'svelte';
	import faviconFetch from 'favicon-fetch';
	let { ready = false, onsearch } = $props();
	let homeQuery = $state('');
	let now = $state(new Date());
	let inputEl;
	onMount(() => {
		inputEl?.focus();
		const timer = setInterval(() => {
			now = new Date();
		}, 15000);
		return () => clearInterval(timer);
	});
	let greeting = $derived.by(() => {
		const hour = now.getHours();
		if (hour < 12) {
			return 'Good morning';
		}
		if (hour < 18) {
			return 'Good afternoon';
		}
		return 'Good evening';
	});

	let clock = $derived(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));

	function submitSearch(event) {
		event.preventDefault();
		if (!ready || !homeQuery.trim()) return;
		onsearch(homeQuery);
		homeQuery = '';
	}
	const quickLinks = [
		{ label: 'YouTube', url: 'https://youtube.com' },
		{ label: 'Discord', url: 'https://discord.com/app' },
		{ label: 'Reddit', url: 'https://reddit.com' },
		{ label: 'Geforce', url: 'https://play.geforcenow.com/mall/' },
		{ label: 'GitHub', url: 'https://github.com' },
		{ label: 'Twitch', url: 'https://twitch.tv' }
	];
</script>

<div class="home">
	<div class="brand-row">
		<h1 class="brand">Ho<span class="filler">6767ha</span>pium</h1>
		<span class="version">v7</span>
	</div>
	<div class="hero">
		<p class="greeting">{greeting} &middot; {clock}</p>
		<form class="home-search" onsubmit={submitSearch}>
			<svg class="home-search-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.4" /><path d="M10.4 10.4L13.6 13.6" /></svg>
			<input
				class="noSelect"
				type="text"
				placeholder="Search or enter address"
				bind:value={homeQuery}
				bind:this={inputEl}
				disabled={!ready}
			/>
		</form>
		{#snippet App(label, url)}
			<button
				class="shortcuts noSelect"
				onclick={() => {
					onsearch(url);
				}}
			>
				<img class="noSelect" src={faviconFetch({ hostname: new URL(url).hostname })} alt="" />
				<span>{label}</span>
			</button>
		{/snippet}

		<div class="apps">
			{#each quickLinks as item}
				{@render App(item.label, item.url)}
			{/each}
		</div>
	</div>
</div>

<style>
	/*...claude helped with some css*/
	.home {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: safe center;
		padding: 40px 20px 14vh;
		box-sizing: border-box;
		overflow: hidden auto;
		background-color: var(--color-bg);
		isolation: isolate;
		margin: 0px;
	}
	.home::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		background:
			radial-gradient(60% 50% at 50% 0%, color-mix(in srgb, var(--accent, #0a84ff) 22%, transparent), transparent 70%),
			radial-gradient(40% 40% at 90% 100%, color-mix(in srgb, var(--accent, #0a84ff) 10%, transparent), transparent 70%);
	}

	.hero {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		max-width: 600px;
		animation: rise 0.7s cubic-bezier(0.16, 0.8, 0.24, 1) both;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(9px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.brand-row {
		position: absolute;
		top: 0;
		left: 0;
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}
	.brand {
		font-family: var(--font-family-heading);
		font-size: clamp(20px, 30px, 35px);
		font-weight: 800;
		letter-spacing: -0.01em;
		line-height: 1;
		text-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
		margin: 15px;
		margin-right: 0px;
	}
	.version {
		margin-top: 14px;
		font-family: var(--font-family-body);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-white);
		background-color: var(--color-scrim-medium);
		border: 1px solid var(--color-border-strong);
		padding: 3px 9px;
		border-radius: 999px;
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
	}

	.greeting {
		margin: 0 0 26px;
		font-family: var(--font-family-heading);
		font-size: clamp(26px, 4.4vw, 34px);
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--color-text);
	}

	.home-search {
		position: relative;
		width: 100%;
		display: flex;
		align-items: center;
	}
	.home-search-icon {
		position: absolute;
		left: 22px;
		width: 17px;
		height: 17px;
		fill: none;
		stroke: var(--color-text-muted);
		stroke-width: 1.5;
		stroke-linecap: round;
		pointer-events: none;
		-webkit-user-select: none; /* Safari */
		-ms-user-select: none; /* IE 10 and IE 11 */
		user-select: none; /* Standard syntax */
		-webkit-user-drag: none; /* Chrome, Safari */
	}
	.home-search input {
		width: 100%;
		height: 56px;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background-color: color-mix(in srgb, var(--color-surface-2) 80%, transparent);
		backdrop-filter: blur(14px);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
		padding: 0 22px 0 52px;
		color: var(--color-text);
		font-size: 16px;
		font-family: var(--font-family-body);
		outline: none;
		box-sizing: border-box;
		transition:
			border-color 0.18s,
			box-shadow 0.18s;
	}
	.home-search input::placeholder {
		color: var(--color-text-subtle);
	}
	.home-search input:focus {
		border-color: var(--accent, var(--color-border-strong));
		box-shadow:
			0 10px 30px rgba(0, 0, 0, 0.3),
			0 0 0 4px color-mix(in srgb, var(--accent, #fff) 22%, transparent);
	}
	.home-search input:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.apps {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 14px;
		margin-top: 28px;
	}
	.shortcuts {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 7px;
		width: 80px;
		height: 82px;
		padding: 0 6px;
		box-sizing: border-box;
		border: 1px solid var(--color-border);
		border-radius: 12px;
		background-color: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
		transition:
			transform 0.18s cubic-bezier(0.16, 0.8, 0.24, 1),
			background-color 0.18s,
			border-color 0.18s;
	}
	.shortcuts:hover {
		transform: translateY(-2px);
		background-color: var(--color-surface-2);
		border-color: var(--color-border-hover);
	}
	.shortcuts:active {
		transform: translateY(0);
	}
	.shortcuts img {
		width: 30px;
		height: 30px;
		flex: none;
		border-radius: 7px;
		object-fit: contain;
	}
	.shortcuts span {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 11.5px;
		color: var(--color-text-muted);
	}
	.shortcuts p {
		margin: 0;
		min-width: 0;
		font-family: var(--font-family-body);
		font-size: 13px;
		font-weight: 500;
		color: inherit;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	@media (max-width: 560px) {
		.apps {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
