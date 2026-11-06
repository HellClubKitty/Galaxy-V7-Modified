<script>
	import '$lib/style/settings.css';
	import { onMount } from 'svelte';
	import { ext, extList, isOn, toggleExt, removeExt, importExtension, initExtensions } from '$lib/os/extensions.svelte.js';

	let msg = $state('');
	let paste = $state('');
	let pasteOpen = $state(false);
	onMount(initExtensions);

	async function pick(e) {
		const input = e.currentTarget;
		msg = '';
		for (const file of input.files ?? []) {
			try {
				msg = `Added “${importExtension(await file.text(), file.name).name}”.`;
			} catch (err) {
				msg = err instanceof Error ? err.message : String(err);
			}
		}
		input.value = '';
	}
	function addPasted() {
		try {
			msg = `Added “${importExtension(paste, 'Pasted extension').name}”.`;
			paste = '';
			pasteOpen = false;
		} catch (err) {
			msg = err instanceof Error ? err.message : String(err);
		}
	}
	const sample = `// @name Hello
// @description Shows a greeting in the menu bar.
const count = Number(hopium.storage.get('count', 0)) + 1;
hopium.storage.set('count', count);
hopium.bar.set('Hello x' + count);
hopium.on('click', () => hopium.toast('Hi from an extension!'));`;
	const browserSample = `{
  "name": "Example page tweak",
  "description": "Adds a small style to example.com",
  "matches": ["https://example.com/*"],
  "contentScript": "document.documentElement.dataset.hopium = 'active';",
  "css": "body { outline: 2px solid #30d158; }"
}`;
</script>

<div class="group">
	<div class="subGroup">
		<p class="subHeading">Installed</p>
		<p class="desc">Switch extensions on or off. They also appear in the browser’s puzzle menu.</p>
		<div class="list">
			{#each extList() as e (e.id)}
				<div class="row">
					<div class="info">
						<b>{e.name}{#if e.builtin}<span class="tag">Built in</span>{:else if e.contentScripts?.length}<span class="tag">Browser</span>{/if}</b>
						<span>{e.description || 'No description.'}</span>
					</div>
					{#if !e.builtin}<button class="toggleBtn" onclick={() => removeExt(e.id)}>Remove</button>{/if}
					<button class="sw" class:on={isOn(e.id)} role="switch" aria-checked={isOn(e.id)} aria-label="Toggle {e.name}" onclick={() => toggleExt(e.id)}><i></i></button>
				</div>
			{/each}
		</div>
	</div>

	<div class="subGroup">
		<p class="subHeading">Add your own</p>
		<p class="desc">A <code>.js</code> add-on runs in a sandbox with no network and gets the <code>hopium</code> API. You can also import a JSON manifest with website content scripts:</p>
		<ul class="api">
			<li><code>hopium.toast(text)</code> / <code>hopium.notify(text)</code> shows a message</li>
			<li><code>hopium.bar.set(text)</code> / <code>hopium.bar.clear()</code> sets or clears the menu label</li>
			<li><code>hopium.on('click', fn)</code> runs when the menu label is clicked</li>
			<li><code>hopium.open('settings')</code> / <code>hopium.run('settings')</code> opens a dock app by id or name</li>
			<li><code>hopium.storage.get(key, fallback)</code> / <code>set(key, value)</code> persists values for the extension</li>
		</ul>
		<pre>{sample}</pre>
		<p class="desc">Browser manifest example. Match patterns support <code>&lt;all_urls&gt;</code>, <code>https://site.example/*</code>, and wildcard subdomains. Content scripts run in the matched proxied page and can read or change that page’s DOM.</p>
		<pre>{browserSample}</pre>
		<div class="content">
			<label class="actionBtn pick">
				Choose file…
				<input type="file" accept=".js,.json,text/javascript,application/json" multiple hidden onchange={pick} />
			</label>
			<button class="toggleBtn" class:active={pasteOpen} onclick={() => (pasteOpen = !pasteOpen)}>Paste code</button>
		</div>
		{#if pasteOpen}
			<textarea class="paste" bind:value={paste} placeholder={sample} spellcheck="false"></textarea>
			<div class="content"><button class="actionBtn" disabled={!paste.trim()} onclick={addPasted}>Add extension</button></div>
		{/if}
		{#if msg}<p class="desc">{msg}</p>{/if}
		<p class="desc warn">Only install extensions you trust. Browser content scripts run with the permissions of the page they modify; do not import code from unknown sources.</p>
	</div>
</div>

<style>
	.list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 14px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 10px 10px 14px;
		border-radius: var(--radius-control);
		background: var(--color-surface);
	}
	.info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
		font-size: 13px;
	}
	.info span {
		font-size: 12px;
		line-height: 1.4;
		color: var(--color-text-muted);
	}
	.tag {
		margin-left: 8px;
		padding: 1px 7px;
		border-radius: 999px;
		background: var(--overlay-hover-strong);
		font-size: 10.5px;
		font-weight: 600;
		color: var(--color-text-muted);
	}
	.sw {
		position: relative;
		flex: none;
		width: 40px;
		height: 24px;
		padding: 0;
		border-radius: 999px;
		background: var(--color-surface-3);
		box-shadow: inset 0 0 0 1px var(--color-border-strong);
		transition: background 0.15s;
	}
	.sw i {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #fff;
		transition: transform 0.15s var(--ease-out);
	}
	.sw.on {
		background: #30d158;
		box-shadow: none;
	}
	.sw.on i {
		transform: translateX(16px);
	}
	.api {
		margin: 10px 0 0;
		padding-left: 18px;
		font-size: 12.5px;
		line-height: 1.7;
		color: var(--color-text-muted);
	}
	pre {
		margin: 12px 0 0;
		padding: 10px 12px;
		overflow-x: auto;
		border-radius: var(--radius-control);
		background: var(--color-surface);
		font-family: var(--font-family-mono);
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--color-text-muted);
	}
	.pick {
		cursor: pointer;
	}
	.paste {
		display: block;
		width: 100%;
		min-height: 220px;
		margin-top: 12px;
		padding: 10px 12px;
		resize: vertical;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-control);
		background: var(--color-surface);
		font-family: var(--font-family-mono);
		font-size: 12px;
		color: var(--color-text);
	}
	.warn {
		color: #ff9f0a;
	}
</style>
