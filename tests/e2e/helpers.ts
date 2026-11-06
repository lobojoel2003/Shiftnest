import { expect, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ADMIN = {
	name: 'Alex Rivera',
	email: 'alex@example.org',
	password: 'correct-horse-battery'
};

/** Emails delivered to the test SMTP server started by scripts/e2e-server.js. */
const MAIL_DIR = '.e2e-data/mail';

interface Email {
	to: string;
	subject: string;
	text: string;
}

function findEmail(to: string, subject?: RegExp): Email | undefined {
	const files = readdirSync(MAIL_DIR).sort().reverse();
	for (const file of files) {
		const mail = JSON.parse(readFileSync(join(MAIL_DIR, file), 'utf8')) as Email;
		if (
			mail.to?.toLowerCase().includes(to.toLowerCase()) &&
			(!subject || subject.test(mail.subject))
		) {
			return mail;
		}
	}
	return undefined;
}

/** Wait for the newest email to `to` (optionally matching `subject`) to arrive. */
export async function lastEmail(to: string, subject?: RegExp): Promise<Email> {
	let found: Email | undefined;
	await expect
		.poll(() => (found = findEmail(to, subject)), {
			message: `email to ${to}${subject ? ` matching ${subject}` : ''}`,
			timeout: 10_000
		})
		.toBeTruthy();
	return found!;
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
