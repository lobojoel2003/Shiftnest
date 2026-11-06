# Security policy

Shiftnest stores volunteers’ names, emails and phone numbers, so we take security seriously.

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

Security fixes are released as patch versions. Running the `:1` Docker tag (or the latest 1.x release) keeps you up to date.

## Reporting a vulnerability

Please **don’t** open a public issue. Instead, use GitHub’s private reporting:
[Report a vulnerability](https://github.com/lobojoel2003/Shiftnest/security/advisories/new).

Include what you found, how to reproduce it, and the version (from `/api/health`). You’ll get an acknowledgement within a few days, and we’ll keep you posted until a fix is released. We’re happy to credit you in the release notes.

## How Shiftnest protects data

- Coordinator passwords are hashed with scrypt; sessions and one-time links are stored only as SHA-256 hashes.
- Volunteer links and calendar feeds use 192-bit random tokens and can be rotated at any time.
- Form submissions are protected against CSRF by origin checks; cookies are `HttpOnly` and `SameSite=Lax` (and `Secure` over HTTPS).
- A strict Content Security Policy blocks third-party scripts; there are no external requests from the browser.
- Logins, sign-ups and link requests are rate limited; public forms include a spam honeypot.
- CSV exports neutralize spreadsheet formulas.
- SMTP and Twilio credentials come only from environment variables, never the database.
- Docker images run as a non-root user and ship with an SBOM and signed build provenance.
