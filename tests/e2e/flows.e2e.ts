import { expect, test, type Browser } from '@playwright/test';
import { ADMIN, expectToast, fillPerson, lastEmail, linkIn, signIn } from './helpers';

test.describe.configure({ mode: 'serial' });

const MAYA = { name: 'Maya Patel', email: 'maya@example.com', phone: '(555) 010-1001' };
const BEN = { name: 'Ben Carter', email: 'ben@example.com' };
const CY = { name: 'Cy Okafor', email: 'cy@example.com' };

/** A date a few days out (UTC), so it's well past the 24-hour cancellation cutoff. */
function daysFromNow(days: number): string {
	return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

async function volunteerPage(browser: Browser) {
	const context = await browser.newContext();
	return context.newPage();
}

/** Sign a volunteer in on a fresh device using the "email me my link" flow. */
async function signInVolunteer(browser: Browser, email: string) {
	const page = await volunteerPage(browser);
	await page.goto('/my', { waitUntil: 'networkidle' });
	await page.getByLabel('Email address').fill(email);
	await page.getByRole('button', { name: 'Email me my link' }).click();
	await expect(page.getByText('Check your inbox')).toBeVisible();
	const link = linkIn((await lastEmail(email, /^Your shifts with/)).text, '/v/');
	await page.goto(link);
	await expect(page).toHaveURL(/\/my$/);
	return page;
}

test('first run sends you to setup and creates the owner account', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/setup$/);
	await page.getByLabel('Group or organization name').fill('Riverside Food Bank');
	await page.getByLabel('Your name').fill(ADMIN.name);
	await page.getByLabel('Email').fill(ADMIN.email);
	await page.getByLabel('Password').fill(ADMIN.password);
	await page.getByLabel('Time zone').selectOption('UTC');
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL(/\/admin$/);
	await expectToast(page, 'Welcome to Shiftnest');

	// Setup can't be run twice.
	await page.goto('/setup');
	await expect(page).toHaveURL(/\/admin$/);
});

test('coordinator creates an event with repeating weekly shifts', async ({ page }) => {
	await signIn(page);
	await page.goto('/admin/events/new');
	await page.getByLabel('Event name').fill('Saturday Pantry');
	await page.getByLabel(/One-line summary/).fill('Hand out groceries to local families.');
	await page.getByLabel(/^Location/).fill('120 Main St');
	await page.getByRole('button', { name: 'Create event' }).click();
	await expect(page).toHaveURL(/\/admin\/events\/\d+/);
	await expectToast(page, 'Now add some shifts');

	await page.getByLabel('Role or task').fill('Sorting');
	await page.getByLabel('Date').fill(daysFromNow(3));
	await page.getByLabel('Starts').fill('09:00');
	await page.getByLabel('Ends').fill('12:00');
	await page.getByLabel('Spots').fill('2');
	await page.getByLabel('Repeat').selectOption('weekly');
	await page.getByLabel('How many shifts').fill('3');
	await page.getByRole('button', { name: 'Add shift' }).click();
	await expectToast(page, '3 shifts added');
	await expect(page.locator('a[href^="/admin/shifts/"]')).toHaveCount(3);
});

test('volunteer signs up with just a name and email', async ({ browser }) => {
	const page = await volunteerPage(browser);
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Riverside Food Bank/ })).toBeVisible();
	await page.getByRole('link', { name: /^Saturday Pantry/ }).click();
	await page
		.getByRole('link', { name: /^Sign up/ })
		.first()
		.click();
	await fillPerson(page, MAYA);
	await page.getByLabel(/Anything we should know/).fill('Bringing my teenager');
	await page.getByRole('button', { name: 'Confirm sign-up' }).click();

	await expect(page).toHaveURL(/\/my$/);
	await expectToast(page, 'You’re signed up for Sorting');
	await expect(page.getByRole('heading', { name: 'Hi, Maya!' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Sorting' })).toHaveCount(1);

	const confirmation = await lastEmail(MAYA.email, /^You’re signed up/);
	expect(confirmation.subject).toContain('You’re signed up: Sorting');
	expect(confirmation.text).toContain('/v/');

	// Personal calendar feed.
	const feedUrl = await page.getByLabel('Calendar feed address').inputValue();
	const feed = await page.request.get(feedUrl);
	expect(feed.headers()['content-type']).toContain('text/calendar');
	const ics = await feed.text();
	expect(ics).toContain('BEGIN:VEVENT');
	expect(ics).toContain('SUMMARY:Sorting · Saturday Pantry');
});

test('a full shift cannot be overbooked', async ({ browser }) => {
	const ben = await volunteerPage(browser);
	await ben.goto('/events/saturday-pantry');
	await ben
		.getByRole('link', { name: /^Sign up/ })
		.first()
		.click();
	await fillPerson(ben, BEN);
	await ben.getByRole('button', { name: 'Confirm sign-up' }).click();
	await expect(ben).toHaveURL(/\/my$/);

	// Typing someone else's email doesn't reveal that they're on the shift:
	// the answer looks like a normal sign-up and the real owner gets their link.
	const stranger = await volunteerPage(browser);
	const probe = await stranger.request.post('/events/saturday-pantry/1', {
		form: { name: 'Someone Else', email: BEN.email },
		headers: { origin: 'http://localhost:4173', accept: 'text/html' },
		maxRedirects: 0
	});
	expect(probe.status()).toBe(303);
	expect(probe.headers()['location']).toBe('/events/saturday-pantry');
	await lastEmail(BEN.email, /^Your shifts with/);

	const cy = await volunteerPage(browser);
	await cy.goto('/events/saturday-pantry');
	const first = cy.locator('li.shift').first();
	await expect(first.locator('.action').getByText('Full', { exact: true })).toBeVisible();
	await expect(first.getByRole('link', { name: /^Sign up/ })).toHaveCount(0);
});

test('a volunteer asks for cover and someone else takes the shift', async ({ browser }) => {
	const maya = await signInVolunteer(browser, MAYA.email);
	await maya.getByRole('button', { name: 'Find cover' }).click();
	await expectToast(maya, 'needing cover');
	const coverUrl = await maya.getByLabel(/Cover link for Sorting/).inputValue();
	await lastEmail(MAYA.email, /^Looking for cover/);

	// The shift now shows as needing cover on the public page.
	const cy = await volunteerPage(browser);
	await cy.goto('/events/saturday-pantry');
	await expect(cy.locator('li.shift').first().getByText('Needs cover')).toBeVisible();

	await cy.goto(coverUrl);
	await expect(cy.getByRole('heading', { name: 'Can you cover for Maya P.?' })).toBeVisible();
	await fillPerson(cy, CY);
	await cy.getByRole('button', { name: 'Take this shift' }).click();
	await expect(cy).toHaveURL(/\/my$/);
	await expectToast(cy, 'we’ve let Maya P. know');

	await lastEmail(MAYA.email, /^Covered! Cy Okafor/);
	await maya.reload();
	await expect(maya.getByText('Nothing scheduled')).toBeVisible();

	// The used link no longer works.
	await cy.goto(coverUrl);
	await expect(cy.getByRole('heading', { name: 'This shift is covered' })).toBeVisible();
});

test('a volunteer switches to another week, then cancels', async ({ browser }) => {
	const cy = await signInVolunteer(browser, CY.email);
	await cy.getByRole('link', { name: 'Switch time' }).click();
	await cy.getByRole('radio').first().check();
	await cy.getByRole('button', { name: 'Switch my shift' }).click();
	await expectToast(cy, 'Switched!');
	await lastEmail(CY.email, /^Switched/);

	cy.once('dialog', (d) => d.accept());
	await cy.getByRole('button', { name: 'Cancel' }).click();
	await expectToast(cy, 'You’re off Sorting');
	await expect(cy.getByText('Nothing scheduled')).toBeVisible();
	await lastEmail(ADMIN.email, /^Cy Okafor cancelled/);
});

test('coordinator manages the roster and sees messages and hours', async ({ page }) => {
	await signIn(page);
	await page.getByRole('link', { name: 'Events & shifts' }).first().click();
	await expect(page).toHaveURL(/\/admin\/events$/);
	await page.getByRole('link', { name: 'Saturday Pantry', exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/events\/\d+$/);
	await page.locator('a[href^="/admin/shifts/"]').first().click();
	await expect(page.getByRole('heading', { name: 'Sorting' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Ben Carter' })).toBeVisible();
	await expect(page.locator('details').getByText('Cy Okafor')).toBeAttached(); // in the changes list

	// Add someone directly, even though the shift is full.
	await page.getByLabel('Name', { exact: true }).fill('Dana Lee');
	await page.locator('#add-email').fill('dana@example.com');
	await page.getByRole('button', { name: 'Add to shift' }).click();
	await expectToast(page, 'Dana Lee added');

	page.once('dialog', (d) => d.accept());
	await page.getByRole('button', { name: 'Remove Dana Lee' }).click();
	await expectToast(page, 'Dana Lee was removed');
	await lastEmail('dana@example.com', /no longer on Sorting/);

	await page.goto('/admin/messages');
	await expect(page.getByRole('cell', { name: /maya@example.com/ }).first()).toBeVisible();
	// Personal links are hidden from coordinators in the message log.
	await page
		.getByRole('link', { name: /^Your shifts with/ })
		.first()
		.click();
	await expect(page.getByText('[private link hidden]')).toBeVisible();
	await expect(page.locator('pre.body')).not.toContainText('/v/');

	await page.goto('/admin/volunteers');
	await expect(page.getByRole('link', { name: 'Maya Patel' })).toBeVisible();
	const csv = await page.request.get('/admin/volunteers/export');
	expect(csv.headers()['content-type']).toContain('text/csv');
	expect(await csv.text()).toContain('maya@example.com');

	const hours = await page.request.get('/admin/hours/export?kind=volunteers');
	expect(await hours.text()).toContain('Volunteer,Email,Shifts,Hours');
});

test('private pages stay private', async ({ browser }) => {
	const page = await volunteerPage(browser);
	await page.goto('/admin');
	await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
	await page.goto('/my');
	await expect(page.getByRole('heading', { name: 'Find your shifts' })).toBeVisible();
	const res = await page.request.post('/admin/settings?/save', { form: { orgName: 'Hacked' } });
	expect([401, 403]).toContain(res.status());
	const bad = await page.request.get('/ical/v/not-a-real-token.ics');
	expect(bad.status()).toBe(404);

	// Encoded or oddly written paths still reach the sign-in check.
	for (const path of [
		'/%61dmin/volunteers/export',
		'/%61dmin/events/1/roster.csv',
		'/%61%64%6d%69%6e/hours/export',
		'/admin//volunteers/export',
		'/%61dmin/messages/1/__data.json?x-sveltekit-invalidated=001'
	]) {
		const res = await page.request.get(path, { maxRedirects: 0 });
		// Pages answer with a 303 to the sign-in page; data requests with a JSON redirect.
		const redirected =
			(res.status() === 303 && res.headers()['location']?.startsWith('/login')) ||
			(await res.text()).startsWith('{"type":"redirect","status":303,"location":"/login');
		expect(redirected, path).toBe(true);
	}
	const forged = await page.request.post('/%61dmin/settings?/save', {
		form: { orgName: 'Hacked' },
		headers: { origin: 'http://localhost:4173', accept: 'text/html' },
		maxRedirects: 0
	});
	expect(forged.status()).not.toBe(200);
	expect(forged.status()).not.toBe(303);
});

test('health check reports version and build', async ({ request }) => {
	const res = await request.get('/api/health');
	expect(res.ok()).toBe(true);
	const body = await res.json();
	expect(body).toMatchObject({ status: 'ok', database: 'ok' });
	expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
});
