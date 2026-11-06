export function getWispUrl(custom) {
	if (custom) return custom;
	const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
	return `${protocol}://${location.host}/lively/`;
}

export function createConnection() {
	return new window.BareMux.BareMuxConnection('/charon/worker.js');
}

const transports = {
	epoxy: ['/reflux/index.mjs', '/libbybutslightlyworse/index.mjs'],
	libcurl: ['/reflux/index.mjs', '/libby/index.mjs'],
	libcurlRaw: ['/libby/index.mjs', '/libby/index.mjs']
};

export async function setCar(connection, car, custom) {
	const entry = transports[car];
	if (!entry) return;
	const [path, base] = entry;
	await connection.setTransport(path, [{ base, wisp: getWispUrl(custom) }]);
}
