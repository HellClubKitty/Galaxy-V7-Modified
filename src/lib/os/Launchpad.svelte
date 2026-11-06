<script>
	import { onMount, tick } from 'svelte';
	import AppIcon from './AppIcon.svelte';

	/* mode "launchpad": paged full-screen grid. mode "spotlight": small search bar. */
	let { apps, mode = 'launchpad', onlaunch, onsearch, onadd, onclose } = $props();

	let query = $state('');
	let input;
	let sel = $state(0);
	let page = $state(0);
	let vw = $state(1280);
	let vh = $state(800);
	let wheelLock = false;

	const cols = $derived(vw < 640 ? 3 : vw < 1000 ? 5 : 7);
	const rows = $derived(vh < 560 ? 2 : vh < 760 ? 3 : 4);
	const perPage = $derived(cols * rows);

	const matches = $derived(
		query.trim() ? apps.filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase())) : apps
	);
	const webRow = $derived(query.trim() && matches.length === 0);
	// The grid ends with an "Add app" tile when not searching.
	const items = $derived(query.trim() || !onadd ? matches : [...matches, { id: '__add', add: true, name: 'Add app' }]);
	const pages = $derived(Math.max(1, Math.ceil(items.length / perPage)));

	$effect(() => {
		if (page > pages - 1) page = pages - 1;
	});

	function setQuery(v) {
		query = v;
		sel = 0;
		page = 0;
	}
	function pick(item) {
		if (item.add) onadd();
		else onlaunch(item);
	}
	function submit() {
		if (webRow) return onsearch(query.trim());
		const it = items[sel];
		if (it) pick(it);
	}
	function go(next) {
		sel = Math.max(0, Math.min(items.length - 1, next));
		page = Math.floor(sel / perPage);
	}
	function key(e) {
		if (e.key === 'Escape') onclose();
		else if (e.key === 'Enter') submit();
		else if (e.key === 'ArrowRight') (e.preventDefault(), go(sel + 1));
		else if (e.key === 'ArrowLeft') (e.preventDefault(), go(sel - 1));
		else if (e.key === 'ArrowDown') (e.preventDefault(), go(sel + cols));
		else if (e.key === 'ArrowUp') (e.preventDefault(), go(sel - cols));
	}
	function wheel(e) {
		if (mode !== 'launchpad' || pages < 2 || wheelLock) return;
		const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
		if (Math.abs(d) < 8) return;
		wheelLock = true;
		page = Math.max(0, Math.min(pages - 1, page + (d > 0 ? 1 : -1)));
		setTimeout(() => (wheelLock = false), 450);
	}
	onMount(async () => {
		await tick();
		input?.focus();
	});
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<div class="scrim {mode}" onpointerdown={(e) => (e.stopPropagation(), onclose())} onkeydown={key} onwheel={wheel} role="presentation">
	{#if mode === 'launchpad'}
		<div class="stage" style:--cols={cols} style:--rows={rows}>
			<label class="search" onpointerdown={(e) => e.stopPropagation()}>
				<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" /><path d="M10.6 10.6 14 14" /></svg>
				<input bind:this={input} value={query} oninput={(e) => setQuery(e.currentTarget.value)} placeholder="Search" autocomplete="off" spellcheck="false" />
			</label>

			{#if webRow}
				<button class="web" onpointerdown={(e) => e.stopPropagation()} onclick={submit}>
					<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" /></svg>
					Search the web for “{query.trim()}”
				</button>
			{:else}
				<div class="viewport">
					<div class="track" style:translate="{-page * 100}% 0">
						{#each { length: pages } as _, p}
							<div class="page" inert={p !== page}>
								{#each items.slice(p * perPage, (p + 1) * perPage) as item, k (item.id)}
									{@const idx = p * perPage + k}
									<button
										class="app"
										class:sel={idx === sel && query.trim() !== ''}
										style:--i={k}
										onpointerdown={(e) => e.stopPropagation()}
										onclick={() => pick(item)}
										onpointerenter={() => (sel = idx)}
									>
										{#if item.add}
											<span class="addtile"><svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12" /></svg></span>
										{:else}
											<AppIcon app={item} size={88} />
										{/if}
										<span class="name">{item.name}</span>
									</button>
								{/each}
							</div>
						{/each}
					</div>
				</div>

				{#if pages > 1}
					<div class="dots" onpointerdown={(e) => e.stopPropagation()}>
						{#each { length: pages } as _, p}
							<button class:on={p === page} aria-label="Page {p + 1}" onclick={() => (page = p)}></button>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	{:else}
		<div class="spot" onpointerdown={(e) => e.stopPropagation()} role="dialog" aria-label="Spotlight" tabindex="-1">
			<label class="sbar">
				<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" /><path d="M10.6 10.6 14 14" /></svg>
				<input bind:this={input} value={query} oninput={(e) => setQuery(e.currentTarget.value)} placeholder="Spotlight Search" autocomplete="off" spellcheck="false" />
			</label>
			{#if webRow}
				<button class="row sel" onclick={submit}>
					<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" /></svg>
					<span>Search the web for “{query.trim()}”</span>
				</button>
			{:else if query.trim()}
				<div class="list">
					{#each matches as app, i (app.id)}
						<button class="row" class:sel={i === sel} onclick={() => onlaunch(app)} onpointerenter={() => (sel = i)}>
							<AppIcon {app} size={26} />
							<span>{app.name}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.scrim {
		position: absolute;
		inset: 0;
		z-index: 9500;
		display: flex;
		justify-content: center;
		animation: in 220ms var(--ease-out);
	}
	.scrim.launchpad {
		background: radial-gradient(120% 90% at 50% 40%, rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.5));
		backdrop-filter: blur(44px) saturate(1.6) brightness(0.8);
	}
	.scrim.spotlight {
		align-items: flex-start;
		padding-top: 18vh;
	}
	@keyframes in {
		from {
			opacity: 0;
		}
	}

	.stage {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: min(1120px, 100vw - 48px);
		height: 100%;
		padding: calc(var(--it, 28px) + 22px) 0 28px;
		color: #fff;
		animation: stage 320ms var(--ease-out);
	}
	@keyframes stage {
		from {
			scale: 1.05;
		}
	}
	.search {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 240px;
		height: 32px;
		padding: 0 12px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.16);
		box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.26);
		transition:
			background var(--dur-fast),
			width 200ms var(--ease-out);
	}
	.search:focus-within {
		width: 300px;
		background: rgba(255, 255, 255, 0.22);
	}
	.search svg {
		width: 14px;
		height: 14px;
		flex: none;
		fill: none;
		stroke: rgba(255, 255, 255, 0.75);
		stroke-width: 1.6;
		stroke-linecap: round;
	}
	input {
		flex: 1;
		min-width: 0;
		border: 0;
		outline: 0;
		background: transparent;
		font-size: 14px;
		color: #fff;
	}
	input::placeholder {
		color: rgba(255, 255, 255, 0.6);
	}

	.viewport {
		flex: 1;
		width: 100%;
		min-height: 0;
		margin-top: 4vh;
		overflow: hidden;
	}
	.track {
		display: flex;
		height: 100%;
		transition: translate 420ms var(--ease-out);
	}
	.page {
		flex: none;
		width: 100%;
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		grid-template-rows: repeat(var(--rows), max-content);
		align-content: start;
		justify-items: center;
		gap: clamp(14px, 4vh, 40px) 0;
		padding: 0 8px;
	}
	.app {
		width: 132px;
		max-width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 10px 6px 8px;
		border: 0;
		border-radius: 18px;
		background: transparent;
		font-size: 13px;
		font-weight: 500;
		color: #fff;
		text-shadow: 0 1px 5px rgba(0, 0, 0, 0.55);
		animation: lift 420ms var(--ease-out) both;
		animation-delay: calc(var(--i) * 22ms);
		transition:
			scale 140ms var(--ease-out),
			background var(--dur-fast);
	}
	@keyframes lift {
		from {
			opacity: 0;
			scale: 1.18;
			translate: 0 10px;
		}
	}
	.app:hover {
		scale: 1.07;
	}
	.app:active {
		scale: 0.95;
	}
	.app.sel {
		background: rgba(255, 255, 255, 0.14);
	}
	.name {
		max-width: 100%;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.addtile {
		display: grid;
		place-items: center;
		width: 88px;
		height: 88px;
		border-radius: 22px;
		border: 2px dashed rgba(255, 255, 255, 0.4);
		background: rgba(255, 255, 255, 0.06);
	}
	.addtile svg {
		width: 34px;
		height: 34px;
		fill: none;
		stroke: rgba(255, 255, 255, 0.8);
		stroke-width: 1.6;
		stroke-linecap: round;
	}
	.app:hover .addtile {
		background: rgba(255, 255, 255, 0.14);
	}

	.dots {
		display: flex;
		gap: 12px;
		padding-top: 14px;
		margin-bottom: 84px;
	}
	.dots button {
		width: 8px;
		height: 8px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.35);
		transition:
			background var(--dur-fast),
			scale var(--dur-fast);
	}
	.dots button.on {
		background: #fff;
		scale: 1.15;
	}
	.web {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 6vh;
		padding: 12px 18px;
		border: 0;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.16);
		font-size: 14px;
		color: #fff;
	}
	.web svg {
		width: 15px;
		height: 15px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
	}

	/* Spotlight */
	.spot {
		width: min(640px, calc(100vw - 32px));
		padding: 8px;
		border-radius: 18px;
		background: rgba(40, 40, 44, 0.78);
		backdrop-filter: blur(40px) saturate(1.8);
		box-shadow:
			0 24px 70px rgba(0, 0, 0, 0.5),
			inset 0 0 0 0.5px rgba(255, 255, 255, 0.24);
		color: #fff;
		animation: pop 180ms var(--ease-out);
	}
	@keyframes pop {
		from {
			opacity: 0;
			scale: 0.97;
		}
	}
	.sbar {
		display: flex;
		align-items: center;
		gap: 12px;
		height: 48px;
		padding: 0 12px;
	}
	.sbar svg {
		width: 20px;
		height: 20px;
		flex: none;
		fill: none;
		stroke: rgba(255, 255, 255, 0.65);
		stroke-width: 1.5;
		stroke-linecap: round;
	}
	.sbar input {
		font-size: 22px;
		font-weight: 300;
	}
	.list {
		display: flex;
		flex-direction: column;
		margin-top: 4px;
		padding-top: 6px;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		height: 40px;
		padding: 0 10px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		font-size: 14px;
		color: #fff;
		text-align: left;
	}
	.row.sel {
		background: var(--os-accent, #0a84ff);
	}
	.ico {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
	}
</style>
