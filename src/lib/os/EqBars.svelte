<script>
	let { playing = true, color = 'currentColor' } = $props();
</script>

<span class="eq" class:still={!playing} style:color aria-hidden="true"><i></i><i></i><i></i><i></i></span>

<style>
	.eq {
		display: inline-flex;
		align-items: flex-end;
		gap: 1.5px;
		width: 13px;
		height: 11px;
	}
	i {
		flex: 1;
		height: 100%;
		border-radius: 1px;
		background: currentColor;
		transform-origin: bottom;
		animation: bounce 0.9s ease-in-out infinite;
	}
	i:nth-child(2) {
		animation-delay: -0.35s;
		animation-duration: 1.1s;
	}
	i:nth-child(3) {
		animation-delay: -0.7s;
		animation-duration: 0.8s;
	}
	i:nth-child(4) {
		animation-delay: -0.2s;
		animation-duration: 1.3s;
	}
	.still i {
		animation: none;
		transform: scaleY(0.3);
	}
	@keyframes bounce {
		0%,
		100% {
			transform: scaleY(0.25);
		}
		50% {
			transform: scaleY(1);
		}
	}
</style>
