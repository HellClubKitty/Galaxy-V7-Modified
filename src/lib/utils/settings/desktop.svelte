<script>
	import '$lib/style/settings.css';
	import { onMount } from 'svelte';
	import { prefs, setPref, resetPrefs, initPrefs, accents } from '$lib/os/prefs.svelte.js';
	import { widgets, allWidgets, initWidgets, setShow, toggleWidget, resetWidgets, importWidget, removeCustomWidget } from '$lib/os/widgets.svelte.js';
	import { saveSetting } from '$lib/utils/localspace.js';

	onMount(() => {
		const offs = [initPrefs(), initWidgets()];
		return () => offs.forEach((off) => off());
	});

	let widgetMsg = $state('');
	let paste = $state('');
	let pasteOpen = $state(false);
	async function pickWidgets(e) {
		const input = e.currentTarget;
		widgetMsg = '';
		for (const file of input.files ?? []) {
			try {
				const w = importWidget(await file.text(), file.name);
				widgetMsg = `Added “${w.name}”.`;
			} catch (err) {
				widgetMsg = err instanceof Error ? err.message : String(err);
			}
		}
		input.value = '';
	}
	function addPasted() {
		try {
			const w = importWidget(paste, 'Pasted widget');
			widgetMsg = `Added “${w.name}”.`;
			paste = '';
			pasteOpen = false;
		} catch (err) {
			widgetMsg = err instanceof Error ? err.message : String(err);
		}
	}

	const bootStyles = [['auto', 'Auto'], ['mac', 'macOS'], ['windows', 'Windows'], ['off', 'Off']];
	// The desktop listens for this and plays the real full-screen startup screen.
	// The desktop is the page that owns edit mode, so ask it over the settings channel.
	const setEditingFromSettings = () => saveSetting('widgetsEdit', { t: Date.now() });
	const previewBoot = (style) => saveSetting('bootPreview', { style, t: Date.now() });

	const positions = [['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']];
	const shadows = [['none', 'Flat'], ['soft', 'Soft'], ['deep', 'Deep']];
</script>

<div class="group">
	<div class="subGroup">
		<p class="subHeading">Dock position</p>
		<div class="content">
			{#each positions as [value, label]}
				<button class="toggleBtn" class:active={prefs.dockPos === value} onclick={() => setPref('dockPos', value)}>{label}</button>
			{/each}
		</div>
		<label class="slide">
			<span>Size <b>{prefs.dockSize}px</b></span>
			<input type="range" min="36" max="76" step="2" value={prefs.dockSize} oninput={(e) => setPref('dockSize', Number(e.currentTarget.value))} />
		</label>
		<div class="content">
			<button class="toggleBtn" class:active={prefs.magnify} onclick={() => setPref('magnify', !prefs.magnify)}>Magnification</button>
			<button class="toggleBtn" class:active={prefs.dockAutoHide} onclick={() => setPref('dockAutoHide', !prefs.dockAutoHide)}>Auto-hide</button>
		</div>
		<label class="slide" class:off={!prefs.magnify}>
			<span>Magnification amount <b>{Math.round(prefs.magnifyAmount * 100)}%</b></span>
			<input type="range" min="1" max="2.2" step="0.1" disabled={!prefs.magnify} value={prefs.magnifyAmount} oninput={(e) => setPref('magnifyAmount', Number(e.currentTarget.value))} />
		</label>
	</div>

	<div class="subGroup">
		<p class="subHeading">Icons</p>
		<p class="desc">Original keeps the plain glyphs. Tiles puts each one on a coloured rounded square.</p>
		<div class="content">
			<button class="toggleBtn" class:active={prefs.iconStyle === 'plain'} onclick={() => setPref('iconStyle', 'plain')}>Original</button>
			<button class="toggleBtn" class:active={prefs.iconStyle === 'tile'} onclick={() => setPref('iconStyle', 'tile')}>Tiles</button>
		</div>
		<p class="subHeading gap">Accent colour</p>
		<div class="content swatches">
			{#each accents as [name, value]}
				<button class="sw" class:on={prefs.accent === value} style:background={value} aria-label={name} title={name} onclick={() => setPref('accent', value)}></button>
			{/each}
		</div>
	</div>
</div>

<div class="group">
	<div class="subGroup">
		<p class="subHeading">Windows</p>
		<div class="content">
			<button class="toggleBtn" class:active={prefs.trafficLights === 'color'} onclick={() => setPref('trafficLights', 'color')}>Coloured buttons</button>
			<button class="toggleBtn" class:active={prefs.trafficLights === 'mono'} onclick={() => setPref('trafficLights', 'mono')}>Grey buttons</button>
		</div>
		<label class="slide">
			<span>Corner radius <b>{prefs.windowRadius}px</b></span>
			<input type="range" min="0" max="22" step="1" value={prefs.windowRadius} oninput={(e) => setPref('windowRadius', Number(e.currentTarget.value))} />
		</label>
		<div class="content">
			{#each shadows as [value, label]}
				<button class="toggleBtn" class:active={prefs.windowShadow === value} onclick={() => setPref('windowShadow', value)}>{label} shadow</button>
			{/each}
		</div>
	</div>

	<div class="subGroup">
		<p class="subHeading">Menu bar</p>
		<div class="content">
			<button class="toggleBtn" class:active={prefs.menuBar === 'glass'} onclick={() => setPref('menuBar', 'glass')}>Translucent</button>
			<button class="toggleBtn" class:active={prefs.menuBar === 'solid'} onclick={() => setPref('menuBar', 'solid')}>Solid</button>
		</div>
		<div class="content">
			<button class="toggleBtn" class:active={prefs.clock24} onclick={() => setPref('clock24', !prefs.clock24)}>24-hour clock</button>
			<button class="toggleBtn" class:active={prefs.clockDate} onclick={() => setPref('clockDate', !prefs.clockDate)}>Show date</button>
		</div>
	</div>
</div>

<div class="group">
	<div class="subGroup">
		<p class="subHeading">Glass &amp; wallpaper</p>
		<p class="desc">One glass material is shared by the dock, menu bar, panels, widgets and the Spotify HUD.</p>
		<label class="slide">
			<span>Blur <b>{prefs.glassBlur}px</b></span>
			<input type="range" min="0" max="60" step="2" value={prefs.glassBlur} oninput={(e) => setPref('glassBlur', Number(e.currentTarget.value))} />
		</label>
		<label class="slide">
			<span>Tint <b>{Math.round(prefs.glassStrength * 100)}%</b></span>
			<input type="range" min="0.04" max="0.4" step="0.02" value={prefs.glassStrength} oninput={(e) => setPref('glassStrength', Number(e.currentTarget.value))} />
		</label>
		<div class="content">
			<button class="toggleBtn" class:active={prefs.wallpaperFx} onclick={() => setPref('wallpaperFx', !prefs.wallpaperFx)}>Wallpaper effects</button>
		</div>
		<p class="desc">Wallpaper effects add a slow drift, a soft vignette and a shade under the menu bar.</p>
	</div>

	<div class="subGroup">
		<p class="subHeading">Startup screen</p>
		<p class="desc">Shown while the desktop loads. Click or press any key to skip it. Auto matches the computer you’re on.</p>
		<div class="content">
			{#each bootStyles as [value, label]}
				<button class="toggleBtn" class:active={prefs.bootStyle === value} onclick={() => setPref('bootStyle', value)}>{label}</button>
			{/each}
		</div>
		<div class="content">
			<button class="actionBtn" onclick={() => previewBoot('mac')}>Preview macOS</button>
			<button class="actionBtn" onclick={() => previewBoot('windows')}>Preview Windows</button>
		</div>
	</div>
</div>

<div class="group">
<div class="subGroup">
	<p class="subHeading">Widgets</p>
	<p class="desc">Drag a widget to move it. Right-click the desktop → Edit widgets to add or remove them in place.</p>
	<div class="content">
		<button class="toggleBtn" class:active={widgets.show} onclick={() => setShow(!widgets.show)}>Show widgets</button>
	</div>
	<div class="content" class:off={!widgets.show}>
		{#each allWidgets() as w (w.id)}
			<button class="toggleBtn" class:active={widgets.items[w.id]?.on} onclick={() => toggleWidget(w.id)}>{w.name}</button>
		{/each}
	</div>
	<p class="subHeading gap">Import a widget</p>
	<p class="desc">A widget is a single <code>.html</code> file (or a <code>.json</code> with <code>name</code>, <code>w</code>, <code>h</code> and <code>html</code>). It runs in a sandbox with no network access. Add <code>&lt;meta name="widget-size" content="240x160"&gt;</code> to set its size.</p>
	<div class="content">
		<label class="actionBtn pick">
			Choose file…
			<input type="file" accept=".html,.htm,.json,text/html,application/json" multiple hidden onchange={pickWidgets} />
		</label>
		<button class="toggleBtn" class:active={pasteOpen} onclick={() => (pasteOpen = !pasteOpen)}>Paste HTML</button>
	</div>
	{#if pasteOpen}
		<textarea class="paste" bind:value={paste} placeholder="<div>Hello</div>" spellcheck="false"></textarea>
		<div class="content"><button class="actionBtn" disabled={!paste.trim()} onclick={addPasted}>Add widget</button></div>
	{/if}
	{#if widgetMsg}<p class="desc">{widgetMsg}</p>{/if}
	{#if widgets.custom.length}
		<div class="customList">
			{#each widgets.custom as c (c.id)}
				<div class="customRow">
					<span>{c.name} <em>{c.w}×{c.h}</em></span>
					<button class="toggleBtn" onclick={() => removeCustomWidget(c.id)}>Remove</button>
				</div>
			{/each}
		</div>
	{/if}
	<div class="content">
		<button class="actionBtn" onclick={() => setEditingFromSettings()}>Edit on desktop…</button>
		<button class="actionBtn" onclick={resetWidgets}>Reset widget positions</button>
	</div>
</div>
</div>

<div class="subGroup">
	<p class="subHeading">Desktop</p>
	<div class="content">
		<button class="toggleBtn" class:active={prefs.desktopIcons} onclick={() => setPref('desktopIcons', !prefs.desktopIcons)}>Icons on desktop</button>
		<button class="toggleBtn" class:active={prefs.lockScreen} onclick={() => setPref('lockScreen', !prefs.lockScreen)}>Lock screen at start</button>
		<button class="toggleBtn" class:active={prefs.animations} onclick={() => setPref('animations', !prefs.animations)}>Animations</button>
	</div>
	<p class="desc">Turn animations off if the desktop feels slow on this computer.</p>
	<div class="content">
		<button class="actionBtn" onclick={resetPrefs}>Reset to defaults</button>
	</div>
</div>

<style>
	.slide {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 16px;
		font-size: 13px;
		color: var(--color-text-muted);
	}
	.pick {
		cursor: pointer;
	}
	.paste {
		display: block;
		width: 100%;
		min-height: 110px;
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
	.customList {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 12px;
	}
	.customRow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 6px 6px 6px 12px;
		border-radius: var(--radius-control);
		background: var(--color-surface);
		font-size: 13px;
	}
	.customRow em {
		font-style: normal;
		color: var(--color-text-subtle);
		margin-left: 6px;
	}
	.content.off {
		opacity: 0.45;
	}
	.slide.off {
		opacity: 0.45;
	}
	.slide b {
		float: right;
		font-weight: 600;
		color: var(--color-text);
	}
	input[type='range'] {
		width: 100%;
		accent-color: var(--color-pin);
	}
	.gap {
		margin-top: 22px;
	}
	.swatches {
		gap: 12px;
	}
	.sw {
		width: 26px;
		height: 26px;
		padding: 0;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.3);
	}
	.sw.on {
		outline: 2px solid var(--color-text);
		outline-offset: 2px;
	}
</style>
