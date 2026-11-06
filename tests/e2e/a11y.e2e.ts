import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

// Runs after flows.e2e.ts has created an organization, an event and volunteers.
test.describe.configure({ mode: 'serial' });

async function expectAccessible(page: Page, path: string) {
	await page.goto(path, { waitUntil: 'networkidle' });
	const results = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
		.analyze();
	const serious = results.violations.filter(
		(v) => v.impact === 'serious' || v.impact === 'critical'
	);
	expect(
		serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`),
		`Accessibility problems on ${path}`
	).toEqual([]);
}

test('public pages have no serious accessibility problems', async ({ page }) => {
	for (const path of ['/', '/events/saturday-pantry', '/my', '/login', '/login/forgot']) {
		await expectAccessible(page, path);
	}
	await page.goto('/events/saturday-pantry');
	const signup = await page
		.getByRole('link', { name: /^Sign up/ })
		.first()
		.getAttribute('href');
	await expectAccessible(page, signup!);
});

test('coordinator pages have no serious accessibility problems', async ({ page }) => {
	await signIn(page);
	for (const path of [
		'/admin',
		'/admin/events',
		'/admin/events/1',
		'/admin/shifts/1',
		'/admin/volunteers',
		'/admin/hours',
		'/admin/messages',
		'/admin/team',
		'/admin/settings'
	]) {
		await expectAccessible(page, path);
	}
});
