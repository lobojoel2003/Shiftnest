// Shiftnest production server.
//
// Wraps the SvelteKit adapter-node handler so the public origin can be set at
// runtime with ORIGIN (adapter-node 6 only reads it at build time), and so plain
// HTTP installs (a laptop, a Raspberry Pi on the LAN) work without extra setup.
//
//   ORIGIN=https://volunteer.example.org node server.js
//
// Environment:
//   PORT (3000), HOST (0.0.0.0), ORIGIN, TRUST_PROXY, SHUTDOWN_TIMEOUT (30)
//   ADDRESS_HEADER / XFF_DEPTH (client IP behind a proxy, see adapter-node docs)
import http from 'node:http';
import process from 'node:process';

// adapter-node reads these when its handler module loads.
process.env.PROTOCOL_HEADER = 'x-shiftnest-proto';
process.env.HOST_HEADER = 'x-shiftnest-host';
process.env.PORT_HEADER = '';

const { handler } = await import('./build/handler.js');

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const trustProxy = ['1', 'true', 'yes'].includes((process.env.TRUST_PROXY || '').toLowerCase());
const shutdownTimeout = Number(process.env.SHUTDOWN_TIMEOUT || 30) * 1000;

let origin = null;
if (process.env.ORIGIN) {
	try {
		origin = new URL(process.env.ORIGIN);
	} catch {
		console.error(`[shiftnest] ORIGIN is not a valid URL: ${process.env.ORIGIN}`);
		process.exit(1);
	}
} else if (process.env.NODE_ENV === 'production') {
	console.warn(
		'[shiftnest] ORIGIN is not set. Links in emails and calendar feeds need it, e.g. ORIGIN=https://volunteer.example.org'
	);
}

function first(value) {
	return (Array.isArray(value) ? value[0] : (value ?? '')).split(',')[0].trim();
}

const server = http.createServer((req, res) => {
	// Never trust these from the outside world.
	delete req.headers['x-shiftnest-proto'];
	delete req.headers['x-shiftnest-host'];

	if (origin) {
		req.headers['x-shiftnest-proto'] = origin.protocol.replace(':', '');
		req.headers['x-shiftnest-host'] = origin.host;
	} else {
		const forwardedProto = trustProxy ? first(req.headers['x-forwarded-proto']) : '';
		const forwardedHost = trustProxy ? first(req.headers['x-forwarded-host']) : '';
		req.headers['x-shiftnest-proto'] = forwardedProto || (req.socket.encrypted ? 'https' : 'http');
		req.headers['x-shiftnest-host'] = forwardedHost || req.headers.host || `localhost:${port}`;
	}

	handler(req, res, () => {
		res.statusCode = 404;
		res.end('Not found');
	});
});

server.listen(port, host, () => {
	console.info(
		`[shiftnest] Listening on http://${host}:${port}${origin ? ` (public URL ${origin.origin})` : ''}`
	);
});

let shuttingDown = false;
function shutdown(signal) {
	if (shuttingDown) return;
	shuttingDown = true;
	console.info(`[shiftnest] ${signal} received, shutting down`);
	server.close(() => {
		// Lets the app stop background work and close the database cleanly.
		process.emit('sveltekit:shutdown', signal);
		process.exit(0);
	});
	server.closeIdleConnections();
	setTimeout(() => server.closeAllConnections(), shutdownTimeout).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
