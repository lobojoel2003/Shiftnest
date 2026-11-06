// Regenerates the images in docs/images from a running demo instance.
//
//   npm run build && npm run screenshots
//
// Starts the production build with demo data on a temporary database, then uses
// Playwright's Chromium to capture the pages shown in the README.
import { chromium, devices } from '@playwright/test';
import Database from 'better-sqlite3';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 4400;
const BASE = `http://localhost:${PORT}`;
const OUT = 'docs/images';
const TZ = 'America/New_York';
const dataDir = mkdtempSync(join(tmpdir(), 'shiftnest-shots-'));
const dbPath = join(dataDir, 'shiftnest.db');
mkdirSync(OUT, { recursive: true });

const server = spawn('node', ['server.js'], {
	stdio: ['ignore', 'inherit', 'inherit'],
	env: {
		...process.env,
		PORT: String(PORT),
		ORIGIN: BASE,
		DATABASE_PATH: dbPath,
		NODE_ENV: 'production',
		SHIFTNEST_DEMO: 'true',
		SHIFTNEST_DEMO_TIMEZONE: TZ,
		// Pretend email is configured so the setup banner doesn't appear; nothing is sent.
		SMTP_HOST: 'smtp.example.org',
		SHIFTNEST_DISABLE_WORKERS: 'true'
	}
});

async function waitForServer() {
	for (let i = 0; i < 60; i++) {
		try {
			if ((await fetch(`${BASE}/api/health`)).ok) return;
		} catch {
			// not up yet
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	throw new Error('Server did not start');
}

function pastShiftId() {
	const db = new Database(dbPath, { readonly: true });
	const row = db
		.prepare(
			`SELECT id FROM shifts WHERE role = 'Distribution line' AND ends_at < ? ORDER BY starts_at DESC LIMIT 1`
		)
		.get(Date.now());
	db.close();
	return row.id;
}

const launch = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

try {
	await waitForServer();
	const browser = await chromium.launch(launch);
	const desktop = {
		viewport: { width: 1280, height: 800 },
		deviceScaleFactor: 2,
		timezoneId: TZ,
		locale: 'en-US',
		colorScheme: 'light'
	};

	async function shoot(page, path, name, opts = {}) {
		await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
		if (opts.before) await opts.before(page);
		await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: opts.fullPage ?? false });
		console.log(`  ✓ ${name}.png`);
	}

	// Volunteer views
	const volunteer = await browser.newContext(desktop);
	const vp = await volunteer.newPage();
	await shoot(vp, '/', 'home');
	await shoot(vp, '/events/saturday-food-distribution', 'event');
	const signupHref = await vp
		.locator('a.btn-primary[href^="/events/saturday-food-distribution/"]')
		.first()
		.getAttribute('href');
	await shoot(vp, signupHref ?? '/', 'signup');
	await shoot(vp, '/swap/demo-cover-request', 'cover');
	await vp.goto(`${BASE}/v/demo-volunteer`, { waitUntil: 'networkidle' });
	await shoot(vp, '/my', 'my-shifts');

	// Coordinator views
	const admin = await browser.newContext(desktop);
	const ap = await admin.newPage();
	await ap.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
	await ap.getByLabel('Email').fill('admin@example.org');
	await ap.getByLabel('Password').fill('shiftnest-demo');
	await Promise.all([
		ap.waitForURL('**/admin'),
		ap.getByRole('button', { name: 'Sign in' }).click()
	]);
	await shoot(ap, '/admin', 'dashboard');
	await shoot(ap, '/admin/events/1', 'admin-event');
	await shoot(ap, `/admin/shifts/${pastShiftId()}`, 'roster');
	await shoot(ap, '/admin/hours', 'hours');
	await shoot(ap, '/admin/volunteers', 'volunteers');

	const dark = await browser.newContext({
		...desktop,
		colorScheme: 'dark',
		storageState: await admin.storageState()
	});
	await shoot(await dark.newPage(), '/admin', 'dashboard-dark');

	// Phones
	const phone = await browser.newContext({
		...devices['iPhone 15 Pro'],
		timezoneId: TZ,
		locale: 'en-US'
	});
	const pp = await phone.newPage();
	await pp.goto(`${BASE}/v/demo-volunteer`, { waitUntil: 'networkidle' });
	const phoneShots = [];
	for (const [path, name] of [
		['/events/saturday-food-distribution', 'phone-event'],
		['/my', 'phone-my-shifts'],
		['/swap/demo-cover-request', 'phone-cover']
	]) {
		await pp.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
		phoneShots.push(await pp.screenshot());
		console.log(`  ✓ ${name} (for mobile.png)`);
	}

	// Compose the phone screenshots into one image.
	const composer = await browser.newContext({
		viewport: { width: 1280, height: 860 },
		deviceScaleFactor: 2
	});
	const cp = await composer.newPage();
	const imgs = phoneShots
		.map((b) => `<img src="data:image/png;base64,${b.toString('base64')}">`)
		.join('');
	await cp.setContent(`<!doctype html><html><body style="margin:0">
		<div style="height:860px;display:flex;gap:40px;align-items:center;justify-content:center;
			background:radial-gradient(900px 500px at 20% 0%,#ccefe9,transparent 70%),radial-gradient(700px 400px at 100% 100%,#fdf1d6,transparent 70%),#f6f7f4">
			<style>img{width:340px;border-radius:44px;border:10px solid #16201c;box-shadow:0 30px 60px -20px rgba(16,24,20,.35)}</style>
			${imgs}
		</div></body></html>`);
	await cp.screenshot({ path: `${OUT}/mobile.png` });
	console.log('  ✓ mobile.png');

	// Logo PNGs and the social preview card.
	const logo = readFileSync('static/favicon.svg', 'utf8');
	const icon = await browser.newContext({
		viewport: { width: 180, height: 180 },
		deviceScaleFactor: 1
	});
	const ip = await icon.newPage();
	await ip.setContent(
		`<html><body style="margin:0">${logo.replace('<svg ', '<svg width="180" height="180" ')}</body></html>`
	);
	await ip.screenshot({ path: 'static/apple-touch-icon.png', omitBackground: true });
	console.log('  ✓ static/apple-touch-icon.png');

	const card = await browser.newContext({
		viewport: { width: 1280, height: 640 },
		deviceScaleFactor: 1
	});
	const sp = await card.newPage();
	const hero = readFileSync(`${OUT}/dashboard.png`).toString('base64');
	await sp.setContent(`<!doctype html><html><body style="margin:0;font-family:Inter,system-ui,sans-serif">
		<div style="width:1280px;height:640px;display:flex;align-items:center;gap:56px;padding:0 0 0 80px;box-sizing:border-box;overflow:hidden;
			background:radial-gradient(900px 500px at 0% 0%,#ccefe9,transparent 70%),#f6f7f4">
			<div style="flex:0 0 470px">
				${logo.replace('<svg ', '<svg width="96" height="96" ')}
				<h1 style="font-size:72px;letter-spacing:-0.03em;margin:28px 0 12px;color:#16201c">Shiftnest</h1>
				<p style="font-size:30px;line-height:1.3;color:#46524e;margin:0">Free, ad-free volunteer shift sign-ups you can host yourself.</p>
			</div>
			<img src="data:image/png;base64,${hero}" style="width:900px;border-radius:18px;box-shadow:0 30px 60px -20px rgba(16,24,20,.35);border:1px solid #e2e6e1">
		</div></body></html>`);
	await sp.screenshot({ path: `${OUT}/social-preview.png` });
	console.log('  ✓ social-preview.png');

	writeFileSync(`${OUT}/logo.svg`, logo);
	await browser.close();
} finally {
	server.kill('SIGTERM');
	rmSync(dataDir, { recursive: true, force: true });
}
