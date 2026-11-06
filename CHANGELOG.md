# Changelog

All notable changes to Shiftnest are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Every release also has a **build number** (the CI run that produced it), shown in the
admin sidebar, in `/api/health`, and as the `build-N` Docker tag.

## [Unreleased]

## [1.0.0] - 2026-11-06

The first stable release: everything a small volunteer group needs to fill shifts,
remind people, handle swaps and count hours, without ads or monthly fees.

### Added

**For volunteers**

- Sign up for a shift with just a name and email. No account or password.
- A personal “My shifts” page reached by a private link (emailed, or requested any time
  from “Find my shifts”), with upcoming shifts, history and total hours.
- **Switch** to another time in the same event in one step.
- **Find cover**: list a shift as needing cover and share a link. You stay on the
  schedule until someone takes it, so the spot never goes empty. Whoever takes it is
  swapped in automatically and both people are emailed.
- Cancel online, up to a cutoff the organization chooses (24 hours by default).
- Self check-in (“I’m here”) from a phone, from an hour before the shift.
- Calendar sync: a personal iCal feed for Apple Calendar, Google Calendar and Outlook,
  single-shift `.ics` downloads, “Add to Google Calendar” links, and a public feed per
  event.
- Optional text-message reminders for people who opt in.

**For coordinators**

- First-run setup, coordinator accounts with owner/coordinator roles, email
  invitations and password resets.
- Events with draft, published and archived states, and a shareable sign-up page.
- Shifts with roles, capacity, location and notes; repeat daily, weekly or every two
  weeks (keeping local times across daylight-saving changes); overnight shifts.
- Dashboard with this week’s fill rate, shifts that need people, open cover
  requests and recent sign-ups.
- Rosters with attendance (attended / no-show), hour overrides, “mark all
  attended”, adding people directly (even to a full shift) and removing them.
- Editing a shift’s time or place emails everyone on it; deleting a shift or event
  tells signed-up volunteers it’s cancelled.
- Email everyone on an event or a single shift.
- Volunteer directory with search, profiles, private notes, link resets and deletion.
- Hours report by volunteer and by event for any date range, with CSV exports.
- Printable sign-in sheets and roster CSV per event.
- Message log of every email and text, with delivery status and retry.
- Settings for name, welcome message, time zone, date format, reminder times,
  cancellation cutoff, self check-in and attendance counting.

**Under the hood**

- SvelteKit 3 + Svelte 5, a single SQLite file, no external services required.
- Email through any SMTP provider; text messages through your own Twilio account.
  Without SMTP, messages are saved to the message log instead of being lost.
- Background worker for reminders and an outbox with retries and back-off.
- Security: scrypt password hashing, hashed session tokens, CSRF protection, strict
  Content Security Policy, rate limiting, honeypot spam protection, formula-safe CSV.
  Every coordinator page, action and download checks the session itself, personal,
  reset and invite links are hidden from the message log, and public forms never
  reveal who has signed up.
- Demo mode (`SHIFTNEST_DEMO=true`) with a realistic food bank to explore.
- `/api/health` endpoint with version, build number and commit.
- Multi-arch Docker image (amd64, arm64) running as a non-root user, with a health
  check, SBOM and signed build provenance.
- CI on every push (lint, type-check, unit tests on Node 22 and 24, end-to-end tests
  with real SMTP delivery, automated WCAG 2.1 AA accessibility checks, Docker smoke
  test, CodeQL) and automated releases from version tags.

[Unreleased]: https://github.com/lobojoel2003/Shiftnest/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/lobojoel2003/Shiftnest/releases/tag/v1.0.0
