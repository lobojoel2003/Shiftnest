/**
 * Runtime configuration, read from environment variables.
 * Everything has a safe default so `node build` works out of the box.
 */

export interface SmtpConfig {
	url?: string;
	host?: string;
	port: number;
	secure: boolean;
	user?: string;
	pass?: string;
}

export interface TwilioConfig {
	accountSid: string;
	authToken: string;
	from?: string;
	messagingServiceSid?: string;
}

export interface Config {
	databasePath: string;
	/** Public base URL used in emails and calendar feeds, e.g. https://volunteer.example.org */
	origin: string;
	/** Whether ORIGIN (or BASE_URL) was set explicitly. */
	originConfigured: boolean;
	smtp: SmtpConfig | null;
	mailFrom: string;
	twilio: TwilioConfig | null;
	workersEnabled: boolean;
	workerIntervalMs: number;
	demo: boolean;
	demoPassword: string;
	production: boolean;
}

function bool(value: string | undefined, fallback = false): boolean {
	if (value === undefined || value === '') return fallback;
	return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
	const n = Number.parseInt(value ?? '', 10);
	return Number.isFinite(n) ? n : fallback;
}

export function readConfig(env: Record<string, string | undefined> = process.env): Config {
	const port = env.PORT || '3000';
	const origin = (env.ORIGIN || env.BASE_URL || `http://localhost:${port}`).replace(/\/+$/, '');

	let smtp: SmtpConfig | null = null;
	if (env.SMTP_URL) {
		smtp = { url: env.SMTP_URL, port: 0, secure: false };
	} else if (env.SMTP_HOST) {
		const smtpPort = int(env.SMTP_PORT, 587);
		smtp = {
			host: env.SMTP_HOST,
			port: smtpPort,
			secure: bool(env.SMTP_SECURE, smtpPort === 465),
			user: env.SMTP_USER || undefined,
			pass: env.SMTP_PASS || env.SMTP_PASSWORD || undefined
		};
	}

	let twilio: TwilioConfig | null = null;
	if (
		env.TWILIO_ACCOUNT_SID &&
		env.TWILIO_AUTH_TOKEN &&
		(env.TWILIO_FROM || env.TWILIO_MESSAGING_SERVICE_SID)
	) {
		twilio = {
			accountSid: env.TWILIO_ACCOUNT_SID,
			authToken: env.TWILIO_AUTH_TOKEN,
			from: env.TWILIO_FROM || undefined,
			messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID || undefined
		};
	}

	const host = (() => {
		try {
			return new URL(origin).hostname;
		} catch {
			return 'localhost';
		}
	})();

	return {
		databasePath: env.DATABASE_PATH || './data/shiftnest.db',
		origin,
		originConfigured: !!(env.ORIGIN || env.BASE_URL),
		smtp,
		mailFrom: env.MAIL_FROM || `Shiftnest <no-reply@${host}>`,
		twilio,
		workersEnabled: !bool(env.SHIFTNEST_DISABLE_WORKERS),
		workerIntervalMs: Math.max(5, int(env.WORKER_INTERVAL_SECONDS, 30)) * 1000,
		demo: bool(env.SHIFTNEST_DEMO),
		demoPassword: env.SHIFTNEST_DEMO_PASSWORD || 'shiftnest-demo',
		production: env.NODE_ENV === 'production'
	};
}

let cached: Config | null = null;

export function config(): Config {
	cached ??= readConfig();
	return cached;
}

/**
 * In development, links in emails should point at whatever port Vite is using.
 * Production never guesses: a spoofed Host header must not end up in emails.
 */
export function learnOrigin(origin: string): void {
	const cfg = config();
	if (!cfg.originConfigured && !cfg.production && cfg.origin !== origin) {
		cached = { ...cfg, origin, originConfigured: true };
	}
}

/** For tests: replace the cached configuration. */
export function setConfig(next: Config | null): void {
	cached = next;
}
