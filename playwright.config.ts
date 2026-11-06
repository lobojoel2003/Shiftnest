import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const E2E_DB = '.e2e-data/shiftnest.db';

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.e2e.ts',
	// The flows share one database and build on each other.
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'off',
		launchOptions: process.env.PW_CHROMIUM_PATH
			? { executablePath: process.env.PW_CHROMIUM_PATH }
			: undefined
	},
	projects: [
		{
			name: 'desktop',
			use: { ...devices['Desktop Chrome'] },
			testIgnore: ['**/mobile.e2e.ts', '**/a11y.e2e.ts']
		},
		{
			name: 'accessibility',
			use: { ...devices['Desktop Chrome'] },
			testMatch: '**/a11y.e2e.ts',
			dependencies: ['desktop']
		},
		{
			name: 'mobile',
			use: { ...devices['Pixel 7'] },
			testMatch: '**/mobile.e2e.ts',
			dependencies: ['desktop']
		}
	],
	webServer: {
		command: 'node scripts/e2e-server.js',
		port: PORT,
		reuseExistingServer: false,
		timeout: 60_000,
		env: {
			PORT: String(PORT),
			ORIGIN: `http://localhost:${PORT}`,
			DATABASE_PATH: E2E_DB,
			WORKER_INTERVAL_SECONDS: '5',
			NODE_ENV: 'production',
			// A local SMTP server started by scripts/e2e-server.js.
			SMTP_HOST: '127.0.0.1',
			SMTP_PORT: '2525',
			SMTP_SECURE: 'false',
			MAIL_FROM: 'Shiftnest Tests <tests@example.org>'
		}
	}
});
