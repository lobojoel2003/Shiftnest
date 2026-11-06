# Deploying Shiftnest

This guide covers running Shiftnest on a small server with HTTPS, email, backups and upgrades. A $5 VPS or a Raspberry Pi (64-bit OS) is plenty for hundreds of volunteers.

- [1. Run the container](#1-run-the-container)
- [2. Add HTTPS with a reverse proxy](#2-add-https-with-a-reverse-proxy)
- [3. Set up email](#3-set-up-email)
- [4. Text messages (optional)](#4-text-messages-optional)
- [5. Backups](#5-backups)
- [6. Upgrading](#6-upgrading)
- [Running without Docker](#running-without-docker)
- [Troubleshooting](#troubleshooting)

## 1. Run the container

Create a folder with a `docker-compose.yml`:

```yaml
services:
  shiftnest:
    image: ghcr.io/lobojoel2003/shiftnest:1
    restart: unless-stopped
    ports:
      - '127.0.0.1:3000:3000' # only reachable through the proxy
    volumes:
      - ./data:/data
    env_file: .env
```

and a `.env` (start from [`.env.example`](../.env.example)):

```dotenv
ORIGIN=https://volunteer.example.org
ADDRESS_HEADER=x-forwarded-for
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_USER=your-server-token
SMTP_PASS=your-server-token
MAIL_FROM="Riverside Food Bank <volunteer@example.org>"
```

```bash
mkdir -p data && sudo chown 1000:1000 data   # the container runs as user 1000
docker compose up -d
docker compose logs -f
```

The `:1` tag follows the latest 1.x release, so you get fixes without breaking changes.

> **`ORIGIN` matters.** It must be the exact address people type, including `https://`. It’s used for links in emails and calendar feeds and for protection against cross-site form submissions. If forms fail with “Cross-site POST form submissions are forbidden”, `ORIGIN` doesn’t match the address in the browser.

## 2. Add HTTPS with a reverse proxy

### Caddy (simplest: automatic certificates)

```caddyfile
volunteer.example.org {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
```

### nginx

```nginx
server {
    listen 443 ssl http2;
    server_name volunteer.example.org;
    # ssl_certificate / ssl_certificate_key from certbot

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

With `ADDRESS_HEADER=x-forwarded-for`, rate limits apply per visitor instead of to the proxy.

## 3. Set up email

Any SMTP service works. Use a sending domain you control and set up SPF and DKIM (your provider will walk you through it) so reminders don’t land in spam.

| Provider   | `SMTP_HOST`                         | Port | Notes                                         |
| ---------- | ----------------------------------- | ---- | --------------------------------------------- |
| Postmark   | `smtp.postmarkapp.com`              | 587  | User and password are both your server token. |
| Mailgun    | `smtp.mailgun.org`                  | 587  |                                               |
| Amazon SES | `email-smtp.<region>.amazonaws.com` | 587  | Create SMTP credentials in the SES console.   |
| Brevo      | `smtp-relay.brevo.com`              | 587  | Generous free tier.                           |
| Gmail      | `smtp.gmail.com`                    | 465  | Needs an app password; `SMTP_SECURE=true`.    |

After restarting, go to **Admin → Settings → Send me a test email**, then check **Admin → Messages** for its status. Failed messages show the error and can be retried.

Until SMTP is configured, Shiftnest keeps every message in **Admin → Messages** marked “Logged”, so nothing is lost while you set things up.

## 4. Text messages (optional)

Shiftnest sends text reminders only to volunteers who tick “Text me a reminder too”. Bring your own [Twilio](https://www.twilio.com) account:

```dotenv
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM=+15551234567
# or TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxx…
```

Choose when texts go out under **Admin → Settings → Reminders** (2 hours before by default). Set the default country code there too, so local numbers like `(555) 010-1001` become `+15550101001`. Twilio handles STOP/opt-out replies automatically.

## 5. Backups

Everything lives in one SQLite file (`/data/shiftnest.db`). Take a consistent copy while Shiftnest is running with SQLite’s online backup:

```bash
docker compose exec shiftnest node -e "
  const D = require('better-sqlite3');
  new D('/data/shiftnest.db', { readonly: true })
    .backup('/data/backup-' + new Date().toISOString().slice(0, 10) + '.db')
    .then(() => console.log('done'));
"
```

Then copy `data/backup-*.db` somewhere safe (another machine, object storage). A nightly cron job running the command above plus `rclone` or `restic` works well. To restore, stop the container, replace `shiftnest.db` with a backup (and delete any `shiftnest.db-wal` / `-shm` files), and start it again.

## 6. Upgrading

```bash
docker compose pull
docker compose up -d
```

Migrations run automatically on start-up. Read the [changelog](../CHANGELOG.md) before major-version upgrades. Taking a backup first is always a good idea. To pin an exact version, use a tag like `ghcr.io/lobojoel2003/shiftnest:1.0.0`.

Check what you’re running at any time:

```bash
curl -s https://volunteer.example.org/api/health
```

## Running without Docker

Download `shiftnest-vX.Y.Z.tar.gz` from the [releases page](https://github.com/lobojoel2003/Shiftnest/releases), check it against `SHA256SUMS.txt`, and extract it. It includes its dependencies; you need Node.js 22.17 or newer.

```bash
tar -xzf shiftnest-v1.0.0.tar.gz && cd shiftnest-v1.0.0
cp .env.example .env   # edit it
node --env-file=.env server.js
```

A minimal systemd unit:

```ini
[Unit]
Description=Shiftnest
After=network.target

[Service]
WorkingDirectory=/opt/shiftnest
ExecStart=/usr/bin/node --env-file=/opt/shiftnest/.env server.js
Environment=NODE_ENV=production
User=shiftnest
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

You can verify downloads were built by this repository’s release workflow:

```bash
gh attestation verify shiftnest-v1.0.0.tar.gz --repo lobojoel2003/Shiftnest
```

## Troubleshooting

| Symptom                                            | Fix                                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| “Cross-site POST form submissions are forbidden”   | Set `ORIGIN` to the exact address in the browser bar (scheme, host and port).           |
| Links in emails point to `localhost`               | Set `ORIGIN`.                                                                           |
| Emails show as “Logged” in Admin → Messages        | SMTP isn’t configured; see [Set up email](#3-set-up-email).                             |
| Emails show as “Failed”                            | Open the message to see the provider’s error, fix the settings, then press “Try again”. |
| `SQLITE_CANTOPEN` or permission errors on start-up | The data folder must be writable by user 1000: `sudo chown -R 1000:1000 data`.          |
| Reminders arrive at the wrong time                 | Check the time zone under Admin → Settings.                                             |
| Everyone shares one rate limit behind a proxy      | Set `ADDRESS_HEADER=x-forwarded-for`.                                                   |
