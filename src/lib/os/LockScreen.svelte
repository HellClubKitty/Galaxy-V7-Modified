<script>
	import { onMount } from 'svelte';
	import { prefs } from './prefs.svelte.js';

	let { bg, onunlock, paused = false } = $props();

	let leaving = $state(false);
	let now = $state(new Date());
	let btn;

	onMount(() => {
		const t = setInterval(() => (now = new Date()), 1000);
		btn?.focus();
		return () => clearInterval(t);
	});

	const time = $derived(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: !prefs.clock24 }).replace(/\s?[AP]M$/i, ''));
	const date = $derived(now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }));

	function enter() {
		if (leaving) return;
		leaving = true;
		setTimeout(onunlock, 280);
	}
</script>

<svelte:window onkeydown={(e) => !paused && (e.key === 'Enter' || e.key === ' ') && enter()} />

<div class="lock" class:leaving style:--bg="url({bg})">
	<div class="pic"></div>
	<div class="clock">
		<div class="date">{date}</div>
		<div class="time">{time}</div>
	</div>
	<div class="login">
		<button bind:this={btn} class="avatar" onclick={enter} aria-label="Enter Hopium">H</button>
		<p class="name">Hopium</p>
		<p class="hint">Click or press Return to enter</p>
	</div>
</div>

<style>
	.lock {
		position: absolute;
		inset: 0;
		z-index: 20000;
		overflow: hidden;
		color: #fff;
		background: #000;
		transition:
			translate 280ms var(--ease-out),
			opacity 280ms,
			scale 280ms var(--ease-out);
	}
	.lock.leaving {
		opacity: 0;
		scale: 1.04;
	}
	.pic {
		position: absolute;
		inset: -40px;
		background: var(--bg) center / cover;
		filter: blur(14px) brightness(0.62) saturate(1.2);
	}
	.clock {
		position: absolute;
		top: 11vh;
		inset-inline: 0;
		text-align: center;
		text-shadow: 0 2px 16px rgba(0, 0, 0, 0.3);
	}
	.date {
		font-size: clamp(18px, 2.6vw, 24px);
		font-weight: 600;
		opacity: 0.92;
	}
	.time {
		font-size: clamp(88px, 15vw, 148px);
		font-weight: 700;
		line-height: 1.02;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.login {
		position: absolute;
		bottom: 9vh;
		inset-inline: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 84px;
		height: 84px;
		border: 0;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.18);
		backdrop-filter: blur(20px);
		box-shadow:
			inset 0 0 0 1px rgba(255, 255, 255, 0.3),
			0 8px 24px rgba(0, 0, 0, 0.3);
		font-size: 36px;
		font-weight: 500;
		color: #fff;
		transition: scale 120ms var(--ease-out);
	}
	.avatar:hover {
		scale: 1.05;
	}
	.name {
		margin: 8px 0 0;
		font-size: 17px;
		font-weight: 600;
	}
	.hint {
		margin: 0;
		font-size: 12.5px;
		opacity: 0.7;
	}
</style>
