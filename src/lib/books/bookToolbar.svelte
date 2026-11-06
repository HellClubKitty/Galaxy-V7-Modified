<script lang="ts">
	import { formatTag } from './catalog';
	import searchIcon from '$lib/img/icons/search.png';
	import shuffle from '$lib/img/icons/shuffle.png';

	let {
		search = $bindable(''),
		selected = $bindable<string[]>([]),
		filter = $bindable('all'),
		tags,
		onrandom
	}: {
		search?: string;
		selected?: string[];
		filter?: 'all' | 'favorites';
		tags: string[];
		onrandom: () => void;
	} = $props();

	const VISIBLE_TAGS = 8;
	let expanded = $state(false);

	const shownTags = $derived.by(() => {
		if (expanded) return tags;
		const head = tags.slice(0, VISIBLE_TAGS);
		for (const t of selected) {
			if (!head.includes(t)) head.push(t);
		}
		return head;
	});

	function toggleTag(t: string) {
		selected = selected.includes(t) ? selected.filter((s) => s !== t) : selected.concat([t]);
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin: 0 24px 24px;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-left: auto;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 18px;
		background: var(--overlay-hover);
		border: 1px solid var(--color-border);
		border-radius: 999px;
		color: var(--color-text-muted);
		font-family: var(--font-family-body);
		font-size: 14px;
		cursor: pointer;
		backdrop-filter: blur(12px);
		transition:
			background 0.2s,
			color 0.2s;
	}
	.pill:hover {
		background: var(--overlay-hover-strong);
		color: var(--color-text);
	}
	.pill.subtle {
		background: transparent;
		color: var(--color-text-subtle);
	}
	.pill.subtle:hover {
		background: var(--overlay-hover);
		color: var(--color-text);
	}
	.pill.active {
		background: var(--color-white);
		color: var(--color-black);
		border-color: var(--color-white);
	}
	.pillIcon {
		height: 16px;
		width: auto;
	}
</style>
