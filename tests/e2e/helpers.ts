import Database from 'better-sqlite3';
import { expect, type Page } from '@playwright/test';

export const ADMIN = {
	name: 'Alex Rivera',
	email: 'alex@example.org',
	password: 'correct-horse-battery'
};
const DB_PATH = '.e2e-data/shiftnest.db';

/** Read the newest queued message for a recipient straight from the database. */
export function lastMessage(to: string, kind?: string): { subject: string; body_text: string } {
	const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
	try {
		const row = db
			.prepare(
				`SELECT subject, body_text FROM outbox WHERE recipient = ? ${kind ? 'AND kind = ?' : ''} ORDER BY id DESC LIMIT 1`
			)
			.get(...(kind ? [to, kind] : [to])) as { subject: string; body_text: string } | undefined;
		if (!row) throw new Error(`No message for ${to}`);
		return row;
	} finally {
		db.close();
	}
}

export function linkIn(text: string, path: string): string {
	const match = text.match(new RegExp(`https?://[^\\s]+${path}[^\\s]*`));
	if (!match) throw new Error(`No ${path} link in message:\n${text}`);
	return match[0];
}

export async function signIn(page: Page) {
	await page.goto('/login', { waitUntil: 'networkidle' });
	await page.getByLabel('Email').fill(ADMIN.email);
	await page.getByLabel('Password').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/admin$/);
}

/** Fill the "who are you" form on sign-up and cover pages. */
export async function fillPerson(
	page: Page,
	person: { name: string; email: string; phone?: string }
) {
	await page.getByLabel('Your name').fill(person.name);
	await page.getByLabel('Email').fill(person.email);
	if (person.phone) await page.getByLabel(/Mobile number/).fill(person.phone);
}

/** Wait for the flash toast and check its text. */
export async function expectToast(page: Page, text: string | RegExp) {
	await expect(page.getByRole('status').filter({ hasText: text })).toBeVisible();
}
