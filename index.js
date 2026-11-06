import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { createServer } from 'node:http';
import { hostname } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { refluxPath } from '@nightnetwork/reflux';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import { readdir, stat, readFile, writeFile } from 'node:fs/promises';
import { brotliCompress, gzip, constants } from 'node:zlib';
import { promisify } from 'node:util';
import { handler as svelteHandler } from './build/handler.js';
wisp.options.dns_servers = ['94.140.14.14', '94.140.15.15'];
wisp.options.dns_method = 'resolve';
wisp.options.dns_result_order = 'ipv4first';
wisp.options.hostname_blacklist = [];

const __dirname = dirname(fileURLToPath(import.meta.url));

/* The proxy bundles are several MB of JavaScript. Compress them once at startup (.br / .gz next
   to the originals) and let @fastify/static serve those, then let browsers cache them for a day. */
const brotli = promisify(brotliCompress);
const gz = promisify(gzip);
async function precompress(dir) {
	let names;
	try {
		names = await readdir(dir);
	} catch {
		return;
	}
	for (const name of names) {
		const file = join(dir, name);
		if (!/\.(js|mjs|wasm|json|css)$/.test(name)) continue;
		try {
			const info = await stat(file);
			if (!info.isFile() || info.size < 4096) continue;
			const [hasBr, hasGz] = await Promise.all([
				stat(file + '.br').then((s) => s.mtimeMs >= info.mtimeMs, () => false),
				stat(file + '.gz').then((s) => s.mtimeMs >= info.mtimeMs, () => false)
			]);
			if (hasBr && hasGz) continue;
			const data = await readFile(file);
			if (!hasBr) {
				const out = await brotli(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 9, [constants.BROTLI_PARAM_SIZE_HINT]: data.length } });
				await writeFile(file + '.br', out);
			}
			if (!hasGz) await writeFile(file + '.gz', await gz(data, { level: 9 }));
		} catch (e) {
			console.warn('precompress skipped', file, e.message);
		}
	}
}
const staticDirs = [join(__dirname, 'glass'), join(__dirname, 'poly'), join(__dirname, 'prism'), epoxyPath, libcurlPath, refluxPath, baremuxPath];
// Do not hold up startup; files are served uncompressed until their compressed copies exist.
Promise.all(staticDirs.map(precompress)).then(() => console.log('Static bundles precompressed'));
const staticOpts = { decorateReply: false, preCompressed: true, maxAge: '1d' };

const fastify = Fastify({
	serverFactory: (handler) => {
		const server = createServer();
		server.on('request', (req, res) => {
			handler(req, res);
		});
		server.on('upgrade', (req, socket, head) => {
			if (req.url.endsWith('/lively/')) {
				wisp.routeRequest(req, socket, head);
			} else socket.end();
		});

		return server;
	}
});

await fastify.register(fastifyStatic, {
	root: join(__dirname, 'glass'),
	prefix: '/glass/',
	...staticOpts
});
await fastify.register(fastifyStatic, {
	root: epoxyPath,
	prefix: '/libbybutslightlyworse/',
	...staticOpts
});
await fastify.register(fastifyStatic, {
	root: libcurlPath,
	prefix: '/libby/',
	...staticOpts
});
await fastify.register(fastifyStatic, {
	root: refluxPath,
	prefix: '/reflux/',
	...staticOpts
});
await fastify.register(fastifyStatic, {
	root: baremuxPath,
	prefix: '/charon/',
	...staticOpts
});
await fastify.register(fastifyStatic, {
	root: join(__dirname, 'poly'),
	prefix: '/poly/',
	...staticOpts
});
await fastify.register(fastifyStatic, {
	root: join(__dirname, 'prism'),
	prefix: '/prism/',
	...staticOpts
});
fastify.all('/*', (req, reply) => {
	svelteHandler(req.raw, reply.raw, () => reply.callNotFound());
});

let port = parseInt(process.env.PORT || '');

if (isNaN(port)) port = 5417;

fastify.server.on('listening', () => {
	const address = fastify.server.address();

	console.log('Listening on:');
	console.log(`\thttp://localhost:${address.port}`);
	console.log(`\thttp://${hostname()}:${address.port}`);
	console.log(
		`\thttp://${
			address.family === 'IPv6' ? `[${address.address}]` : address.address
		}:${address.port}`
	);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown(signal) {
	console.log(`${signal} received: closing HTTP server`);
	fastify.close().then(
		() => process.exit(0),
		() => process.exit(1)
	);
}

await fastify.listen({ port, host: '0.0.0.0' });
