import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config';
import { migrations } from './migrations';

export type DB = Database.Database;

/** Apply any migrations the database hasn't seen yet. */
export function migrate(db: DB): void {
	const current = db.pragma('user_version', { simple: true }) as number;
	if (current > migrations.length) {
		throw new Error(
			`Database schema version ${current} is newer than this build of Shiftnest supports (${migrations.length}). Upgrade Shiftnest.`
		);
	}
	for (let version = current; version < migrations.length; version++) {
		db.transaction(() => {
			db.exec(migrations[version]);
			db.pragma(`user_version = ${version + 1}`);
		})();
	}
}

export function openDatabase(path: string): DB {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
	const db = new Database(path);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	db.pragma('busy_timeout = 5000');
	db.pragma('synchronous = NORMAL');
	migrate(db);
	return db;
}

let instance: DB | null = null;

/** The application's shared database connection. */
export function getDb(): DB {
	instance ??= openDatabase(config().databasePath);
	return instance;
}

export function closeDb(): void {
	if (instance) {
		instance.close();
		instance = null;
	}
}

/** Statuses that occupy a spot on a shift. */
export const ACTIVE_STATUSES = `('confirmed', 'attended', 'no_show')`;
