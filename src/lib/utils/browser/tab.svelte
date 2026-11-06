<script>
	import {
		deleteTab,
		activeTab,
		slotsDragged,
		draggedOverLeft,
		draggedOverRight,
		isTabDragging
	} from '$lib/stores/index.js';
	import faviconFetch from 'favicon-fetch';
	import defaultIcon from '$lib/img/icons/earthWhite.png';
	let { id, displayUrl = '', title = 'New Tab', onDrop } = $props();
	function faviconFor(url) {
		try {
			return url ? faviconFetch({ hostname: new URL(url).hostname }) : defaultIcon;
		} catch {
			return defaultIcon;
		}
	}
	let tabEl;
	let closing = $state(false);
	let hovered = $state(false);
	let compiledTitle = $state([]);
	let faviconUrl = $derived(
		faviconFor(displayUrl)
	);
	let opacity = $state(0.7);
	// svelte-ignore state_referenced_locally
	$effect(() => {
		if (faviconUrl == defaultIcon) {
			opacity = 0.7;
		} else {
			opacity = 1;
		}
		if (title) {
			sliceText(title);
		}
	});
	function closeTab(event) {
		event.stopPropagation();
		closing = true;
		setTimeout(() => ($deleteTab = id), 140);
	}
	function handleAuxClick(event) {
		closeTab(event);
	}
	let pillColor = $derived.by(() => {
		if (id == $activeTab) {
			return 'var(--tab-active, var(--color-surface-2))';
		}

		if (hovered) {
			return 'var(--overlay-hover)';
		}
		return 'transparent';
	});
	let bgColor = $derived.by(() => {
		return 'transparent';
	});
	// svelte-ignore non_reactive_update
	let accumX = $state(0);
	let tabLength = $state(/** @type {number | null} */ (null));
	function callDrag(e) {
		$activeTab = id;
		// @ts-ignore
		accumX = e.movementX;
		addEventListener('mousemove', startDrag);
		addEventListener('mouseup', stopDrag);
		tabLength = tabEl.getBoundingClientRect().width;
	}
	function startDrag(e) {
		$isTabDragging = true;
		accumX -= -e.movementX;
		// @ts-ignore
		$slotsDragged = Math.round(accumX / tabLength);
	}
	function stopDrag(e) {
		removeEventListener('mousemove', startDrag);
		removeEventListener('mouseup', stopDrag);
		accumX = 0;
		$isTabDragging = false;
		onDrop?.(id);
	}
	function sliceText(text) {
		let x = text.length / 2;
		compiledTitle = [text.slice(0, x), text.slice(x)];
	}
</script>

<div
	class="tab noSelect"
	class:active={id == $activeTab}
	class:closing
	{id}
	bind:this={tabEl}
	onmousedown={callDrag}
	onauxclick={(event) => {
		if (event.button === 1) {
			handleAuxClick(event);
		}
	}}
	onmouseover={() => (hovered = true)}
	onmouseout={() => (hovered = false)}
	style={`background-color: ${bgColor}; `}
	style:transform={$isTabDragging ? `translateX(${accumX}px)` : null}
	style:z-index={$isTabDragging ? 10 : null}
	style:border-right={id == $draggedOverLeft ? `1px solid white` : null}
	style:border-left={id == $draggedOverRight ? `1px solid white` : null}
	// I tried but ts won't work
	// so ig I'll just stick with border
	// style:margin-right={id == $draggedOverLeft ? `190px` : null}
	// style:margin-left={id == $draggedOverRight ? `190px` : null}
>
	<div class="pill noSelect" style="background-color: {pillColor};">
		<div class="stuff noSelect">
			<div class="icon noSelect">
				<img src={faviconUrl} class="tab-icon noSelect" alt="" style="opacity:{opacity}" />
			</div>
			<p class="title">{compiledTitle[0]}<span class="filler">haha6767</span>{compiledTitle[1]}</p>
			<button type="button" class="close" onclick={closeTab} onmousedown={(e) => e.stopPropagation()} aria-label="Close tab"><svg viewBox="0 0 12 12"><path d="M3.3 3.3l5.4 5.4M8.7 3.3L3.3 8.7" /></svg></button>
		</div>
	</div>
</div>

<style>
	.tab {
		position: relative;
		height: 36px;
		width: 210px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		animation: expand 0.2s;
		margin-top: auto;
		padding: 0 2px;
		box-sizing: border-box;
		min-width: 0;
		border-right: 1px solid transparent;
		transition:
			margin-left 0.3s ease,
			margin-right 0.3s ease,
			width 0.14s ease,
			opacity 0.14s ease;
	}
	.tab.closing {
		width: 10px;
		opacity: 0;
		pointer-events: none;
	}
	.pill {
		position: relative;
		width: 100%;
		height: 30px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		box-sizing: border-box;
		padding: 0 6px 0 9px;
		transition: background-color 0.15s;
	}
	.tab.active .pill {
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.08),
			0 1px 6px rgba(0, 0, 0, 0.28);
	}
	/* a short accent bar under the active tab */
	.tab.active .pill::after {
		content: '';
		position: absolute;
		left: 50%;
		bottom: 0;
		width: 22px;
		height: 2px;
		translate: -50% 0;
		border-radius: 2px;
		background: var(--accent, var(--color-text));
	}
	.stuff {
		display: flex;
		align-items: center;
		margin-right: auto;
		width: 100%;
		min-width: 0;
	}
	.icon {
		display: grid;
		place-items: center;
		flex: none;
	}
	.title {
		margin: 0;
		min-width: 0;
		flex: 1;
		color: var(--color-text-muted);
		font-size: 12.5px;
		font-family: var(--font-family-body);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}
	.tab.active .title {
		color: var(--color-text);
	}
	.tab-icon {
		height: 15px;
		width: 15px;
		margin-right: 8px;
		border-radius: 3px;
		object-fit: contain;
	}
	.close {
		display: grid;
		place-items: center;
		flex: none;
		width: 20px;
		height: 20px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--color-text-muted);
		opacity: 0;
		transition:
			background 0.15s,
			color 0.15s,
			opacity 0.15s;
	}
	.tab:hover .close,
	.tab.active .close {
		opacity: 1;
	}
	.close svg {
		width: 10px;
		height: 10px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
	}
	.close:hover {
		background: var(--color-danger);
		color: #fff;
	}
	@keyframes expand {
		from {
			width: 50px;
		}
		to {
			width: 210px;
		}
	}
</style>
