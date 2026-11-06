import { loadScript } from './loader';
import { getWispUrl } from './car';
import { codec } from './codec.js';
import { ensureProxyServiceWorker } from './service-worker.js';

let controller;
let transportKey = '';

export { preferredPrismTransport } from './transport-selection.js';

function makeTransport(car, custom) {
	const wisp = getWispUrl(custom);
	if (car === 'epoxy') {
		const Epoxy = window.EpoxyTransport.default ?? window.EpoxyTransport;
		return new Epoxy({ wisp });
	}

	const Libcurl =
		window.LibcurlTransport.LibcurlClient ??
		window.LibcurlTransport.default ??
		window.LibcurlTransport;
	return new Libcurl({ wisp });
}

export async function createPrismController(car = 'libcurl', customWisp) {
	if (controller) {
		const key = `${car}:${getWispUrl(customWisp)}`;
		if (key !== transportKey) await setPrismTransport(car, customWisp);
		return controller;
	}

	const { worker } = await ensureProxyServiceWorker();
	await loadScript('/prism/prism.js');
	await loadScript('/prism/prism.api.js');
	await loadScript(car === 'epoxy' ? '/prism/libbyworse.js' : '/prism/libby.js');

	const transport = makeTransport(car, customWisp);
	await transport.init();

	const { Controller, config } = window.$scramjetController;
	config.scramjetPath = '/prism/prism.js';
	config.injectPath = '/prism/prism.inject.js';
	config.wasmPath = '/prism/prism.wasm';
	config.codec.encode = codec.encode;
	config.codec.decode = codec.decode;

	const nextController = new Controller({ serviceworker: worker, transport });
	await nextController.wait();
	controller = nextController;
	transportKey = `${car}:${getWispUrl(customWisp)}`;
	return controller;
}

export async function setPrismTransport(car, customWisp) {
	if (!controller) return;
	const key = `${car}:${getWispUrl(customWisp)}`;
	if (key === transportKey) return;

	await loadScript(car === 'epoxy' ? '/prism/libbyworse.js' : '/prism/libby.js');
	const transport = makeTransport(car, customWisp);
	await transport.init();
	controller.setTransport(transport);
	transportKey = key;
}

export function getPrismController() {
	return controller;
}
