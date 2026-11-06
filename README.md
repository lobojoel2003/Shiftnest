<div align="center">

<img src="docs/images/logo.svg" alt="" width="88" height="88">

# Shiftnest

**A clean, ad-free volunteer shift scheduler you can host yourself.**<br>
Sign-ups without accounts, free email reminders, easy swaps, hour logging and calendar feeds.

[![CI](https://github.com/lobojoel2003/Shiftnest/actions/workflows/ci.yml/badge.svg)](https://github.com/lobojoel2003/Shiftnest/actions/workflows/ci.yml)
[![CodeQL](https://github.com/lobojoel2003/Shiftnest/actions/workflows/codeql.yml/badge.svg)](https://github.com/lobojoel2003/Shiftnest/actions/workflows/codeql.yml)
[![Latest release](https://img.shields.io/github/v/release/lobojoel2003/Shiftnest?sort=semver&color=0f766e)](https://github.com/lobojoel2003/Shiftnest/releases/latest)
[![Docker image](https://img.shields.io/badge/ghcr.io-shiftnest-0f766e?logo=docker&logoColor=white)](https://github.com/lobojoel2003/Shiftnest/pkgs/container/shiftnest)
[![License: MIT](https://img.shields.io/github/license/lobojoel2003/Shiftnest?color=0f766e)](LICENSE)
![Node 22.17+](https://img.shields.io/badge/node-%E2%89%A522.17-0f766e?logo=node.js&logoColor=white)

[Quick start](#quick-start) · [Features](#features) · [Screenshots](#screenshots) · [Configuration](#configuration) · [Deployment guide](docs/deployment.md) · [Changelog](CHANGELOG.md)

<img src="docs/images/event.png" alt="A public sign-up page listing Saturday Food Distribution shifts by day, with spots filled, a 'Needs cover' badge and Sign up buttons" width="900">

</div>

## Why Shiftnest?

Food banks, animal shelters, mutual aid groups and school parent groups all need people to sign up for shifts, get reminders and log their hours. Small groups usually end up juggling spreadsheets, group chats or ad-heavy free tools.

|                  | Cost                                                                                                                                                | What people say                                                                                                                                                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **VolunteerHub** | $143 to $288 a month, no free version or trial ([Capterra](https://www.capterra.com/p/79209/VolunteerHub/pricing/))                                 | All five VolunteerHub alternatives on [AlternativeTo](https://alternativeto.net/software/volunteerhub/) are closed source.                                                                                                                                        |
| **SignUpGenius** | Free with ads; text reminders and ad-free pages cost $11.99 to $59.99 a month ([Capterra](https://www.capterra.com/p/135392/SignUpGenius/pricing/)) | 87% of the 91 reviews that mention ads complain about them, and 71% of 143 call the interface outdated and cluttered. _“The ads! The paid version doesn’t offer a middle ground that makes sense.”_ ([Capterra](https://www.capterra.com/p/135392/SignUpGenius/)) |
| **Shiftnest**    | Free and open source (MIT). Runs on a $5 server or a Raspberry Pi.                                                                                  | No ads, no tracking, no per-volunteer fees. Email reminders included; texts use your own Twilio account at cost.                                                                                                                                                  |

## Features

### For volunteers

- **Sign up in seconds.** Name and email, that’s it. No account, no password, no app.
- **Free reminders** by email (24 hours and 2 hours before, by default), plus optional text messages for people who opt in.
- **Switch times** in one step when plans change.
- **Find cover instead of leaving a gap.** List a shift as needing cover and share a link. You stay on the schedule until someone takes it, then you’re swapped out automatically and both of you get an email.
- **Calendar sync.** A personal feed for Apple Calendar, Google Calendar and Outlook that updates on its own, plus one-click `.ics` downloads.
- **Phone check-in.** Tap “I’m here” when you arrive.
- **“My shifts” page** with upcoming shifts, history and total hours, reached through a private link. Lost it? “Find my shifts” emails a new one.

### For coordinators

- **Events and shifts** with roles, spots, locations and notes. Repeat a shift daily, weekly or every two weeks to build a whole season at once. Overnight shifts and daylight-saving changes are handled correctly.
- **Dashboard** showing this week’s fill rate, shifts that still need people, open cover requests and recent sign-ups.
- **Rosters** with attendance (attended / no-show), hour adjustments, “mark all attended”, and adding or removing people.
- **Change notifications.** Edit a shift’s time or place and everyone on it is told; cancel a shift and they’re told that too.
- **Announcements** to everyone on an event or a single shift.
- **Hours reports** by volunteer and by event for any date range, ready for grant reports, with CSV export.
- **Printable sign-in sheets**, roster CSVs and a volunteer directory with private notes.
- **A message log** of every email and text with delivery status and one-click retry.
- **Team accounts** with owner and coordinator roles and email invitations.
- **Policies you control:** cancellation cutoff (people can still ask for cover inside it), self check-in, whether unmarked past shifts count as worked, time zone and date format.

### For whoever runs the server

- **One container, one SQLite file.** No database server, no Redis, no external services.
- **Any SMTP provider** for email (Postmark, Mailgun, Amazon SES, Brevo, Fastmail, Gmail…). Without SMTP, messages are kept in the message log instead of disappearing, so you can try everything first.
- **Docker images for amd64 and arm64** (including a Raspberry Pi with a 64-bit OS), running as a non-root user with a health check, SBOM and signed build provenance.
- **Secure defaults:** scrypt password hashing, hashed session tokens, CSRF protection, strict Content Security Policy, rate limiting, spam honeypots and formula-safe CSV exports.
- **Accessible and responsive:** keyboard friendly, screen-reader labels, light and dark mode, works on any phone.

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/images/home.png" alt="Public home page with a welcome message, upcoming events and a 'Needs people soon' list"><br><sub><b>Sign-up page.</b> Your welcome message and every open opportunity.</sub></td>
    <td width="50%"><img src="docs/images/signup.png" alt="Sign-up form for a shift asking only for name, email and an optional phone number"><br><sub><b>Signing up</b> takes a name and an email.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/images/my-shifts.png" alt="A volunteer's personal page with upcoming shifts and buttons to add to calendar, switch time, find cover or cancel"><br><sub><b>My shifts.</b> Switch, find cover, cancel, sync to a calendar.</sub></td>
    <td><img src="docs/images/cover.png" alt="Cover request page asking 'Can you cover for Noah K.?' with the shift details and a form"><br><sub><b>Cover requests</b> are shareable links. Whoever takes one is swapped in automatically.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/images/dashboard.png" alt="Coordinator dashboard with weekly stats, shifts needing volunteers, cover requests and recent sign-ups"><br><sub><b>Dashboard.</b> What needs attention this week.</sub></td>
    <td><img src="docs/images/admin-event.png" alt="Event management page with shifts grouped by day, fill meters, a share link and an add-shifts form"><br><sub><b>Events.</b> Add one shift or a season of repeating shifts.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/images/roster.png" alt="Shift roster with attended and no-show buttons and hour fields for each volunteer"><br><sub><b>Rosters.</b> Attendance and hours in a couple of taps.</sub></td>
    <td><img src="docs/images/hours.png" alt="Hours report with totals and a per-volunteer breakdown"><br><sub><b>Hours.</b> Totals for any period, exportable to CSV.</sub></td>
  </tr>
</table>

<img src="docs/images/mobile.png" alt="Three phone screenshots: an event page, a volunteer's shifts and a cover request" width="100%">

<details>
<summary><b>Dark mode</b></summary>
<br>
<img src="docs/images/dashboard-dark.png" alt="Coordinator dashboard in dark mode">
</details>

## Quick start

### Try it with sample data

```bash
docker run --rm -p 3000:3000 -e SHIFTNEST_DEMO=true ghcr.io/lobojoel2003/shiftnest:latest
```

Open <http://localhost:3000> to see the volunteer side, and <http://localhost:3000/login> to sign in as a coordinator with **admin@example.org** / **shiftnest-demo**. The demo volunteer’s page is at <http://localhost:3000/v/demo-volunteer>.

### Run it for real with Docker

```bash
docker run -d --name shiftnest --restart unless-stopped \
  -p 3000:3000 \
  -v shiftnest-data:/data \
  -e ORIGIN=https://volunteer.example.org \
  -e SMTP_HOST=smtp.example.com -e SMTP_USER=apikey -e SMTP_PASS=secret \
  -e MAIL_FROM="Riverside Food Bank <volunteer@example.org>" \
  ghcr.io/lobojoel2003/shiftnest:latest
```

Then open your site, create the first coordinator account, create an event, add shifts and share the link. Put it behind HTTPS with Caddy or nginx: see the [deployment guide](docs/deployment.md).

### Docker Compose

```bash
curl -O https://raw.githubusercontent.com/lobojoel2003/Shiftnest/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/lobojoel2003/Shiftnest/main/.env.example
# edit .env, then:
docker compose up -d
```

### Without Docker

Download `shiftnest-vX.Y.Z.tar.gz` from the [latest release](https://github.com/lobojoel2003/Shiftnest/releases/latest). It includes everything it needs; you only need [Node.js](https://nodejs.org) 22.17 or newer.

```bash
tar -xzf shiftnest-v1.0.0.tar.gz && cd shiftnest-v1.0.0
ORIGIN=http://localhost:3000 node server.js
```

### Image tags

| Tag                   | What it is                                                 |
| --------------------- | ---------------------------------------------------------- |
| `latest`              | The newest stable release                                  |
| `1`, `1.0`, `1.0.0`   | Pin to a major, minor or exact version (recommended: `1`)  |
| `build-N`             | The image produced by release build number _N_             |
| `edge`, `sha-abc1234` | Built from every green commit on `main`. For testing only. |

## Configuration

Everything is set with environment variables. Only `ORIGIN` is strongly recommended. See [`.env.example`](.env.example) for a ready-to-edit file.

| Variable                                             | Default                                              | Description                                                                                        |
| ---------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `ORIGIN`                                             | `http://localhost:3000`                              | Public address of your site. Used for links in emails and calendar feeds, and for CSRF protection. |
| `DATABASE_PATH`                                      | `./data/shiftnest.db` (Docker: `/data/shiftnest.db`) | SQLite database file. **Back it up.**                                                              |
| `PORT` / `HOST`                                      | `3000` / `0.0.0.0`                                   | Where the server listens.                                                                          |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`   | –                                                    | Your email provider. Port 587 uses STARTTLS; set `SMTP_SECURE=true` for port 465.                  |
| `SMTP_URL`                                           | –                                                    | Alternative to the above, e.g. `smtps://user:pass@smtp.example.com:465`.                           |
| `MAIL_FROM`                                          | `Shiftnest <no-reply@your-host>`                     | Sender shown on emails, e.g. `Riverside Food Bank <volunteer@example.org>`.                        |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`            | –                                                    | Optional text messages through your own Twilio account.                                            |
| `TWILIO_FROM` or `TWILIO_MESSAGING_SERVICE_SID`      | –                                                    | The number (E.164, like `+15551234567`) or messaging service to send from.                         |
| `ADDRESS_HEADER`, `XFF_DEPTH`                        | –                                                    | Behind a proxy, read the visitor’s IP (for rate limiting) from e.g. `x-forwarded-for`.             |
| `TRUST_PROXY`                                        | `false`                                              | Trust `X-Forwarded-Proto/Host` when `ORIGIN` isn’t set.                                            |
| `WORKER_INTERVAL_SECONDS`                            | `30`                                                 | How often reminders are checked.                                                                   |
| `SHIFTNEST_DEMO`                                     | `false`                                              | Load the sample food bank on an empty database. Never use in production.                           |
| `SHIFTNEST_DEMO_PASSWORD`, `SHIFTNEST_DEMO_TIMEZONE` | `shiftnest-demo`, `America/New_York`                 | Demo coordinator password and time zone.                                                           |

Organization settings (name, welcome message, time zone, date format, reminder times, cancellation cutoff, check-in and attendance rules) are edited in **Admin → Settings**. Secrets never live in the database.

## How it works

### Swaps without gaps

```mermaid
sequenceDiagram
    actor Maya as Maya (can’t make it)
    participant S as Shiftnest
    actor Cy as Cy (can help)
    actor C as Coordinator
    Maya->>S: “Find cover” on Saturday’s shift
    S-->>Maya: Shareable cover link. Maya stays on the roster
    S-->>C: Email: cover needed
    Note over S: The shift shows “Needs cover” on the sign-up page
    Cy->>S: Opens the link, enters name and email
    S->>S: One transaction: Maya off, Cy on (spot never empty)
    S-->>Maya: “Covered! Cy is taking your shift”
    S-->>Cy: Confirmation with calendar links
    S-->>C: Email: swap done
```

### Architecture

```mermaid
flowchart LR
    V[Volunteers' phones and browsers] -->|HTTPS| P[Caddy / nginx]
    C[Coordinators] -->|HTTPS| P
    K[Calendar apps] -->|iCal feeds| P
    P --> N[Shiftnest: Node.js + SvelteKit]
    N <--> D[(SQLite file)]
    N --> W[Background worker: reminders + outbox with retries]
    W -->|SMTP| E[Your email provider]
    W -->|REST| T[Twilio, optional]
```

- **SvelteKit 3 + Svelte 5** render every page on the server, so the site works on old phones and slow connections; JavaScript adds instant updates on top.
- **SQLite** (via better-sqlite3) in WAL mode stores everything in one file. Sign-ups use transactions, so two people can never grab the last spot.
- **An outbox table** holds every email and text until it’s delivered. A small in-process worker sends them, retries with back-off, and sends reminders on schedule. Nothing is lost if the email provider has a bad day.
- **Times** are stored in UTC and shown in the organization’s time zone. Repeating shifts keep their local time across daylight-saving changes.

<details>
<summary><b>Project layout</b></summary>

```text
src/
  hooks.server.ts        sessions, first-run setup, admin guard, security headers
  lib/
    server/              database, migrations and all business logic (no UI)
      signups.ts         capacity, cancellation cutoff, switching, swaps, check-in
      reminders.ts       which reminders are due
      outbox.ts          email/SMS queue, SMTP and Twilio delivery with retries
      notifications.ts   every message Shiftnest sends
      ical.ts, feeds.ts  RFC 5545 calendar feeds
      hours.ts           hour totals and reports
    components/          shared Svelte components
    time.ts              time zone math (DST-safe)
  routes/
    (public)/            sign-up pages, "My shifts", cover links
    (auth)/              setup, login, invitations, password reset
    admin/               coordinator area
    ical/, api/health    calendar feeds and health check
server.js                production entry point (wraps the SvelteKit handler)
tests/e2e/               Playwright end-to-end tests
scripts/                 screenshot and e2e helpers
```

</details>

## Versioning and releases

Shiftnest follows [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`. Database migrations run automatically on start-up and are never edited after release, so upgrading is “pull the new image and restart”.

Every build also carries a **build number** (the CI run that produced it) and the **commit hash**. You can see them in the admin sidebar (`Shiftnest v1.0.0 (build 12)`), under **Settings → About this server**, and from the health endpoint:

```console
$ curl https://volunteer.example.org/api/health
{"status":"ok","version":"1.0.0","build":"12","commit":"8c1e0f2…","builtAt":"2026-11-06T05:12:00Z","uptimeSeconds":3600,"database":"ok"}
```

To cut a release, maintainers first move the notes under **Unreleased** in [`CHANGELOG.md`](CHANGELOG.md) to a new version heading, then either:

- **From a terminal:** run `npm version minor` (or `patch` / `major`), which bumps `package.json`, commits `chore(release): vX.Y.Z` and creates the `vX.Y.Z` tag, then `git push --follow-tags`; or
- **From GitHub:** bump the version in `package.json`, push to `main`, then open **Actions → Release → Run workflow** and enter the version (for example `v1.1.0`). The workflow creates the tag for you.

The [release workflow](.github/workflows/release.yml) then checks that the tag, `package.json` and changelog agree, runs the full test suite, builds the Node bundle and the multi-arch Docker image, attaches signed build provenance, and publishes the GitHub Release with notes from the changelog.

## CI/CD

| Workflow                                 | When                              | What it does                                                                                                                                                                                                                  |
| ---------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [CI](.github/workflows/ci.yml)           | Every push and pull request       | Prettier + ESLint, `svelte-check`, unit tests on Node 22 and 24, Playwright end-to-end tests (desktop + mobile), production build smoke test, Docker build and container health check. On `main`, publishes the `edge` image. |
| [Release](.github/workflows/release.yml) | A `vX.Y.Z` tag, or “Run workflow” | Verifies, builds the release bundle (`.tar.gz`, `.zip`, `SHA256SUMS.txt`), pushes `ghcr.io/lobojoel2003/shiftnest` for amd64 and arm64, attests provenance, publishes the GitHub Release.                                     |
| [CodeQL](.github/workflows/codeql.yml)   | Pushes, PRs, weekly               | Static security analysis of the JavaScript and TypeScript code.                                                                                                                                                               |
| [Dependabot](.github/dependabot.yml)     | Weekly                            | Grouped updates for npm packages, GitHub Actions and the Docker base image.                                                                                                                                                   |

## Development

You’ll need Node.js 22.17+ and npm.

```bash
git clone https://github.com/lobojoel2003/Shiftnest.git
cd Shiftnest
npm install
SHIFTNEST_DEMO=true npm run dev     # http://localhost:5173 with sample data
```

| Command                             | What it does                                                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                       | Development server with hot reload. Emails are printed to the terminal.                                                           |
| `npm run check`                     | Type-check Svelte and TypeScript.                                                                                                 |
| `npm run lint` / `npm run format`   | Check / fix formatting and lint rules.                                                                                            |
| `npm test`                          | Unit tests (Vitest), using an in-memory database.                                                                                 |
| `npm run build && npm run test:e2e` | End-to-end and accessibility tests (Playwright + axe) against the production build, with a local SMTP server catching the emails. |
| `npm run build && npm start`        | Run the production build locally.                                                                                                 |
| `npm run screenshots`               | Regenerate the README images from the demo data.                                                                                  |

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions.

## Privacy and security

- Volunteers’ details are only visible to your coordinators. Public pages show first names and initials only on cover requests.
- Personal links and calendar feeds use long random tokens. Volunteers (and coordinators) can reset them at any time, which signs out every device.
- Coordinators can delete a volunteer and all their history, for example when someone asks to be forgotten.
- The message log never shows personal, password-reset or invitation links, so coordinators can’t use them to act as someone else.
- No analytics, no third-party scripts or CDNs, no ads. Pages use your device’s own fonts and bundled icons.

Found a vulnerability? Please report it privately; see [SECURITY.md](SECURITY.md).

## Roadmap

Ideas for future versions (contributions welcome!):

- Waitlists that automatically offer a freed-up spot
- Recurring availability and “notify me about new shifts”
- Minimum age or training requirements per role
- Translations of the interface
- Import volunteers from CSV

## Contributing

Bug reports, ideas and pull requests are very welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## License

[MIT](LICENSE) © 2026 Joel Stain Lobo
