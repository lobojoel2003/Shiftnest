import { expect, test } from '@playwright/test';

async function expectNoHorizontalScroll(page: import('@playwright/test').Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(1);
}

test('sign-up pages fit on a phone', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('link', { name: /^Saturday Pantry/ })).toBeVisible();
	await expectNoHorizontalScroll(page);

	await page.goto('/events/saturday-pantry');
	await expect(page.getByRole('heading', { name: 'Saturday Pantry' })).toBeVisible();
	await expectNoHorizontalScroll(page);

	await page
		.getByRole('link', { name: /^Sign up/ })
		.first()
		.click();
	await expect(page.getByRole('button', { name: 'Confirm sign-up' })).toBeVisible();
	await expectNoHorizontalScroll(page);
});
