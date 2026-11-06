// Starts the production build with a fresh, empty database for end-to-end tests,
// plus a local SMTP server that saves every delivered email as JSON so tests can
// follow the links in them.
//
// Usage: npm run build && npm run test:e2e
import { simpleParser } from 'mailparser';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { SMTPServer } from 'smtp-server';

const dbPath = process.env.DATABASE_PATH ?? '.e2e-data/shiftnest.db';
const dataDir = dirname(dbPath);
const mailDir = join(dataDir, 'mail');
rmSync(dataDir, { recursive: true, force: true });
mkdirSync(mailDir, { recursive: true });

if (!existsSync('build/index.js')) {
	console.error('No build found. Run `npm run build` first.');
	process.exit(1);
}

let count = 0;
const smtp = new SMTPServer({
	authOptional: true,
	disabledCommands: ['STARTTLS', 'AUTH'],
	logger: false,
	onData(stream, _session, callback) {
		simpleParser(stream)
			.then((mail) => {
				const file = join(mailDir, `${String(++count).padStart(5, '0')}.json`);
				const to = Array.isArray(mail.to) ? mail.to.map((a) => a.text).join(', ') : mail.to?.text;
				writeFileSync(file, JSON.stringify({ to, subject: mail.subject, text: mail.text }));
				callback();
			})
			.catch(callback);
	}
});
await new Promise((resolve) =>
	smtp.listen(Number(process.env.SMTP_PORT || 2525), '127.0.0.1', resolve)
);

await import('../server.js');
