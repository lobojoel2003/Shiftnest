/**
 * Schema migrations. Each entry runs once, in order, inside a transaction.
 * The applied version is stored in SQLite's `user_version` pragma.
 * Never edit a migration that has shipped; add a new one instead.
 */
export const migrations: string[] = [
	/* 1: initial schema */ `
	CREATE TABLE settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);

	CREATE TABLE users (
		id INTEGER PRIMARY KEY,
		email TEXT NOT NULL UNIQUE COLLATE NOCASE,
		name TEXT NOT NULL,
		password_hash TEXT,
		role TEXT NOT NULL DEFAULT 'coordinator' CHECK (role IN ('owner', 'coordinator')),
		notify INTEGER NOT NULL DEFAULT 1,
		created_at INTEGER NOT NULL,
		last_login_at INTEGER
	);

	CREATE TABLE volunteers (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		email TEXT NOT NULL UNIQUE COLLATE NOCASE,
		phone TEXT NOT NULL DEFAULT '',
		sms_opt_in INTEGER NOT NULL DEFAULT 0,
		manage_token TEXT NOT NULL UNIQUE,
		calendar_token TEXT NOT NULL UNIQUE,
		notes TEXT NOT NULL DEFAULT '',
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	);

	CREATE TABLE sessions (
		id TEXT PRIMARY KEY,
		user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
		volunteer_id INTEGER REFERENCES volunteers(id) ON DELETE CASCADE,
		expires_at INTEGER NOT NULL,
		created_at INTEGER NOT NULL,
		CHECK ((user_id IS NULL) <> (volunteer_id IS NULL))
	);
	CREATE INDEX sessions_expires ON sessions(expires_at);

	CREATE TABLE auth_tokens (
		id TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		purpose TEXT NOT NULL CHECK (purpose IN ('invite', 'reset')),
		expires_at INTEGER NOT NULL,
		used_at INTEGER,
		created_at INTEGER NOT NULL
	);

	CREATE TABLE events (
		id INTEGER PRIMARY KEY,
		slug TEXT NOT NULL UNIQUE,
		title TEXT NOT NULL,
		summary TEXT NOT NULL DEFAULT '',
		description TEXT NOT NULL DEFAULT '',
		location TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	);

	CREATE TABLE shifts (
		id INTEGER PRIMARY KEY,
		event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
		role TEXT NOT NULL,
		starts_at INTEGER NOT NULL,
		ends_at INTEGER NOT NULL,
		capacity INTEGER NOT NULL CHECK (capacity >= 1),
		location TEXT NOT NULL DEFAULT '',
		notes TEXT NOT NULL DEFAULT '',
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL,
		CHECK (ends_at > starts_at)
	);
	CREATE INDEX shifts_event ON shifts(event_id, starts_at);
	CREATE INDEX shifts_starts ON shifts(starts_at);

	CREATE TABLE signups (
		id INTEGER PRIMARY KEY,
		shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
		volunteer_id INTEGER NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
		status TEXT NOT NULL DEFAULT 'confirmed'
			CHECK (status IN ('confirmed', 'attended', 'no_show', 'cancelled')),
		note TEXT NOT NULL DEFAULT '',
		hours REAL,
		swap_token TEXT UNIQUE,
		swap_requested_at INTEGER,
		checked_in_at INTEGER,
		cancel_reason TEXT,
		cancelled_at INTEGER,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	);
	CREATE UNIQUE INDEX signups_active ON signups(shift_id, volunteer_id) WHERE status <> 'cancelled';
	CREATE INDEX signups_volunteer ON signups(volunteer_id, status);
	CREATE INDEX signups_shift ON signups(shift_id, status);

	CREATE TABLE reminders_sent (
		signup_id INTEGER NOT NULL REFERENCES signups(id) ON DELETE CASCADE,
		channel TEXT NOT NULL,
		offset_hours REAL NOT NULL,
		sent_at INTEGER NOT NULL,
		PRIMARY KEY (signup_id, channel, offset_hours)
	);

	CREATE TABLE outbox (
		id INTEGER PRIMARY KEY,
		channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
		recipient TEXT NOT NULL,
		subject TEXT NOT NULL DEFAULT '',
		body_text TEXT NOT NULL,
		body_html TEXT,
		kind TEXT NOT NULL DEFAULT 'other',
		status TEXT NOT NULL DEFAULT 'pending'
			CHECK (status IN ('pending', 'sent', 'failed', 'logged')),
		attempts INTEGER NOT NULL DEFAULT 0,
		last_error TEXT,
		send_after INTEGER NOT NULL,
		sent_at INTEGER,
		created_at INTEGER NOT NULL
	);
	CREATE INDEX outbox_pending ON outbox(status, send_after);
	CREATE INDEX outbox_created ON outbox(created_at);
	`
];
