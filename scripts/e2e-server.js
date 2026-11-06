// Starts the production build with a fresh, empty database for end-to-end tests.
// Usage: npm run build && npm run test:e2e
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

const dbPath = process.env.DATABASE_PATH ?? '.e2e-data/shiftnest.db';
rmSync(dirname(dbPath), { recursive: true, force: true });
mkdirSync(dirname(dbPath), { recursive: true });

if (!existsSync('build/index.js')) {
	console.error('No build found. Run `npm run build` first.');
	process.exit(1);
}

await import('../server.js');
