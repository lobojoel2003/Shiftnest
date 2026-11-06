# Contributing to Shiftnest

Thanks for helping make volunteer scheduling easier for small groups! Bug reports, ideas, docs fixes and code are all welcome.

## Ground rules

- **Keep it simple to host.** One process, one SQLite file, no required external services. New dependencies need a good reason.
- **Volunteers come first.** Anything a volunteer touches must work on a cheap phone, without an account, and be readable by a screen reader.
- **No tracking, no ads, no third-party scripts.**

## Getting started

```bash
npm install
SHIFTNEST_DEMO=true npm run dev
```

Sign in at <http://localhost:5173/login> with `admin@example.org` / `shiftnest-demo`. Emails are printed in the terminal and saved under Admin → Messages.

## Before you open a pull request

```bash
npm run format
npm run lint
npm run check
npm test
npm run build && npm run test:e2e
```

CI runs the same checks. For UI changes, add screenshots to the pull request (and run `npm run screenshots` if README images change).

## Conventions

- **Code layout.** Business rules live in `src/lib/server/*` as plain functions that take the database as their first argument, so they’re easy to unit-test with an in-memory database (see `src/lib/server/testing.ts`). Route files stay thin.
- **Database changes** are a new entry at the end of `src/lib/server/db/migrations.ts`. Never edit a migration that has been released.
- **Times** are stored as UTC milliseconds. Convert to and from the organization’s time zone with the helpers in `src/lib/time.ts`.
- **User-facing text** is short, friendly and plain. Error messages say what to do next.
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org): `feat: …`, `fix: …`, `docs: …`, `test: …`, `ci: …`, `chore: …`.
- **Changelog.** Add a line under **Unreleased** in `CHANGELOG.md` for anything users will notice.

## Releases

Maintainers release by updating `CHANGELOG.md`, then either running `npm version <patch|minor|major>` and `git push --follow-tags`, or bumping `package.json` on `main` and using **Actions → Release → Run workflow**. The release workflow does the rest; see the README’s “Versioning and releases” section.
