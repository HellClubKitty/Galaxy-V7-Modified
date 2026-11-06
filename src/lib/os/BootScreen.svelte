<script>
	import { onMount } from 'svelte';
	import Logo from './Logo.svelte';

	/* variant: 'mac' | 'windows' | null.  null just paints black while settings are still loading.
	   ready:   hold the bar near the end until the desktop (wallpaper) is actually ready.
	   Click or any key skips it after a short moment. */
	let { variant = null, ready = true, ondone } = $props();

	let progress = $state(0);
	let leaving = $state(false);
	let canSkip = $state(false);
	let startedFor = null;
	let raf = 0;
	let finished = false;

	const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	// [time 0..1, bar 0..1]: the bar eases in a few uneven steps instead of one smooth sweep.
	const CURVE = [
		[0, 0],
		[0.14, 0.07],
		[0.3, 0.26],
		[0.46, 0.4],
		[0.62, 0.66],
		[0.82, 0.86],
		[1, 1]
	];
	function curve(t) {
		for (let i = 1; i < CURVE.length; i++) {
			if (t <= CURVE[i][0]) {
				const [t0, v0] = CURVE[i - 1];
				const [t1, v1] = CURVE[i];
				return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
			}
		}
		return 1;
	}

	function finish() {
		if (finished) return;
		finished = true;
		cancelAnimationFrame(raf);
		progress = 1;
		leaving = true;
		setTimeout(() => ondone?.(), 560);
	}

	function run(kind) {
		const total = reduce ? 800 : kind === 'windows' ? 3200 : 2700;
		const t0 = performance.now();
		setTimeout(() => (canSkip = true), 700);
		const frame = (now) => {
			const t = Math.min(1, (now - t0) / total);
			const target = curve(t);
			// Don't reach the end until the desktop is ready.
			progress = ready ? target : Math.min(target, 0.93);
			if (t >= 1 && ready) return finish();
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
	}

	$effect(() => {
		if (variant && startedFor !== variant) {
			startedFor = variant;
			run(variant);
		}
	});

	onMount(() => () => cancelAnimationFrame(raf));

	function skip() {
		if (canSkip && variant) finish();
	}
</script>

<svelte:window onkeydown={skip} />

<div
	class="boot {variant ?? 'pending'}"
	class:leaving
	onpointerdown={skip}
	role="presentation"
	aria-hidden="true"
>
	{#if variant}
		<div class="glow"></div>
		<div class="stack">
			<span class="logo"><Logo /></span>

			{#if variant === 'mac'}
				<div class="bar" style:--p={progress}><i></i></div>
			{:else}
				<div class="dots">
					{#each [0, 1, 2, 3, 4] as n}<i style:--n={n}></i>{/each}
				</div>
			{/if}
		</div>
		{#if canSkip}<p class="skip">Click to skip</p>{/if}
	{/if}
</div>

<style>
	.boot {
		position: absolute;
		inset: 0;
		z-index: 30000;
		display: grid;
		place-items: center;
		overflow: hidden;
		background: #000;
		color: #fff;
		cursor: default;
		transition: opacity 560ms var(--ease-out, ease-out);
	}
	.boot.leaving {
		opacity: 0;
		pointer-events: none;
	}
	.boot.leaving .stack {
		scale: 1.06;
		transition: scale 560ms var(--ease-out, ease-out);
	}

	/* soft bloom behind the logo */
	.glow {
		position: absolute;
		left: 50%;
		top: 46%;
		width: min(70vmin, 620px);
		aspect-ratio: 1;
		translate: -50% -50%;
		border-radius: 50%;
		background: radial-gradient(closest-side, color-mix(in srgb, var(--os-accent, #0a84ff) 26%, transparent), color-mix(in srgb, var(--os-accent, #0a84ff) 9%, transparent) 52%, color-mix(in srgb, var(--os-accent, #0a84ff) 2%, transparent) 78%, transparent);
		filter: blur(8px);
		opacity: 0;
		animation: bloom 1.6s 0.1s var(--ease-out, ease-out) forwards;
	}
	.stack {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 64px;
		translate: 0 -2vh;
	}
	.logo :global(svg) {
		width: 100%;
		height: 100%;
	}
	.logo {
		display: block;
		width: 88px;
		height: 88px;
		color: #fff;
		filter: drop-shadow(0 0 26px rgba(255, 255, 255, 0.28));
		opacity: 0;
		animation: logo-in 900ms 120ms var(--ease-out, ease-out) forwards;
	}
	@keyframes logo-in {
		from {
			opacity: 0;
			scale: 0.86;
			filter: blur(6px) drop-shadow(0 0 0 transparent);
		}
		to {
			opacity: 1;
			scale: 1;
		}
	}
	@keyframes bloom {
		to {
			opacity: 1;
		}
	}

	/* ---------- macOS: thin progress bar ---------- */
	.bar {
		width: 168px;
		height: 5px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.22);
		overflow: hidden;
		opacity: 0;
		animation: fade-in 500ms 500ms forwards;
	}
	.bar i {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: inherit;
		background: #fff;
		transform-origin: left center;
		transform: scaleX(var(--p));
	}

	/* ---------- Windows: five dots chasing round a ring ---------- */
	.dots {
		position: relative;
		width: 38px;
		height: 38px;
		opacity: 0;
		animation: fade-in 500ms 500ms forwards;
	}
	.dots i {
		position: absolute;
		inset: 0;
		rotate: 0deg;
		opacity: 0;
		animation: orbit 3.1s infinite cubic-bezier(0.35, 0.1, 0.35, 0.95);
		animation-delay: calc(var(--n) * 160ms);
	}
	.dots i::before {
		content: '';
		position: absolute;
		top: 0;
		left: 50%;
		width: 5px;
		height: 5px;
		margin-left: -2.5px;
		border-radius: 50%;
		background: #fff;
	}
	@keyframes orbit {
		0% {
			rotate: 0deg;
			opacity: 0;
		}
		8% {
			opacity: 1;
		}
		45% {
			rotate: 330deg;
			opacity: 1;
		}
		70% {
			rotate: 520deg;
			opacity: 1;
		}
		92% {
			opacity: 1;
		}
		100% {
			rotate: 720deg;
			opacity: 0;
		}
	}
	.windows .stack {
		gap: 78px;
	}
	.windows .logo {
		width: 96px;
		height: 96px;
		filter: drop-shadow(0 0 30px color-mix(in srgb, var(--os-accent, #0a84ff) 55%, transparent));
	}

	@keyframes fade-in {
		to {
			opacity: 1;
		}
	}
	.skip {
		position: absolute;
		bottom: 5vh;
		margin: 0;
		font-size: 12px;
		letter-spacing: 0.02em;
		color: rgba(255, 255, 255, 0.34);
		opacity: 0;
		animation: fade-in 400ms forwards;
	}
	@media (prefers-reduced-motion: reduce) {
		.dots i {
			animation-duration: 6s;
		}
	}
</style>
