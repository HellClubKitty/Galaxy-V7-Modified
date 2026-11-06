<script>
	let { onadd, onclose } = $props();

	const proxies = [
		{ value: 'prism', label: 'SJ2' },
		{ value: 'polygon', label: 'SJ' },
		{ value: 'glass', label: 'UV' }
	];
	const transports = [
		{ value: 'libcurl', label: 'Libcurl' },
		{ value: 'epoxy', label: 'Epoxy' }
	];

	let name = $state('');
	let url = $state('');
	let icon = $state('');
	let proxy = $state('prism');
	let transport = $state('libcurl');
	let wisp = $state('');
	let notif = $state('');
	let advanced = $state(false);
	let error = $state(/** @type {string | null} */ (null));

	function submit(e) {
		e.preventDefault();
		if (!url.trim() || !name.trim()) {
			error = 'Name and URL are required';
			return;
		}
		onadd({ name: name.trim(), url: url.trim(), icon: icon.trim(), proxy, transport, wisp: wisp.trim(), notif: notif.trim() });
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="overlay" onclick={onclose} role="presentation">
	<form class="dialog" onclick={(e) => e.stopPropagation()} onsubmit={submit} role="dialog" aria-label="Add app">
		<h2>Add app</h2>

		<label>URL<input bind:value={url} placeholder="example.com" oninput={() => (error = null)} /></label>
		<label>Name<input bind:value={name} placeholder="Example" oninput={() => (error = null)} /></label>
		<label>Icon<input bind:value={icon} placeholder="Leave blank to detect automatically" /></label>

		<button type="button" class="adv" onclick={() => (advanced = !advanced)} aria-expanded={advanced}>
			<span class="chev" class:open={advanced}></span> Advanced
		</button>
		{#if advanced}
			<div class="panel">
				<span class="cap">Proxy</span>
				<div class="seg">
					{#each proxies as p}
						<button type="button" class:on={proxy === p.value} onclick={() => (proxy = p.value)}>{p.label}</button>
					{/each}
				</div>
				<span class="cap">Transport</span>
				<div class="seg">
					{#each transports as t}
						<button type="button" class:on={transport === t.value} onclick={() => (transport = t.value)}>{t.label}</button>
					{/each}
				</div>
				<label>Wisp<input bind:value={wisp} placeholder="Blank for default" /></label>
				<label>Open notification<input bind:value={notif} placeholder="Shown when the app opens" /></label>
			</div>
		{/if}

		{#if error}<p class="error" role="alert">{error}</p>{/if}

		<div class="actions">
			<button type="button" onclick={onclose}>Cancel</button>
			<button type="submit" class="primary">Add</button>
		</div>
	</form>
</div>

<style>
	.overlay {
		position: absolute;
		inset: 0;
		z-index: 9800;
		display: grid;
		place-items: center;
		background: var(--color-scrim-medium);
		backdrop-filter: blur(8px);
		animation: fade 160ms var(--ease-out);
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	.dialog {
		width: 380px;
		max-width: calc(100vw - 32px);
		max-height: calc(100vh - 48px);
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 20px;
		border-radius: 18px;
		background: var(--color-surface-3);
		box-shadow: var(--shadow-popover);
		animation: pop 220ms var(--ease-out);
	}
	@keyframes pop {
		from {
			opacity: 0;
			translate: 0 10px;
			scale: 0.97;
		}
	}
	h2 {
		margin: 0 0 4px;
		font-family: var(--font-family-heading);
		font-size: 19px;
	}
	label,
	.cap {
		display: flex;
		flex-direction: column;
		gap: 5px;
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-muted);
	}
	input {
		height: 36px;
		padding: 0 12px;
		border-radius: var(--radius-control);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		font-size: 13px;
		font-weight: 400;
		color: var(--color-text);
	}
	input:focus {
		outline: 0;
		border-color: var(--color-pin);
	}
	.adv {
		align-self: flex-start;
		display: flex;
		align-items: center;
		gap: 8px;
		border: 0;
		background: none;
		font-size: 13px;
		color: var(--color-text-muted);
	}
	.chev {
		border-left: 5px solid currentColor;
		border-block: 4px solid transparent;
		transition: rotate var(--dur-fast);
	}
	.chev.open {
		rotate: 90deg;
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px;
		border-radius: var(--radius-card);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
	}
	.seg {
		display: flex;
		gap: 6px;
	}
	.seg button {
		padding: 5px 14px;
		border-radius: 999px;
		border: 1px solid var(--color-border-strong);
		background: transparent;
		font-size: 12px;
		color: var(--color-text-muted);
	}
	.seg button.on {
		background: var(--color-pin);
		border-color: var(--color-pin);
		color: var(--color-text-dark);
	}
	.error {
		margin: 0;
		font-size: 12px;
		color: var(--color-danger);
		text-align: left;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 6px;
	}
	.actions button {
		height: 34px;
		padding: 0 18px;
		border: 0;
		border-radius: var(--radius-control);
		background: var(--overlay-hover-strong);
		font-weight: 600;
		font-size: 13px;
	}
	.actions .primary {
		background: var(--color-pin);
		color: var(--color-text-dark);
	}
</style>
