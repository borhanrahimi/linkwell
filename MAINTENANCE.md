# Keeping Linkwell running

For future you, coming back after months away. What lives where, which
secrets exist, and what to do when something breaks. Never write a secret's
**value** in this file: only its name and where to find it.

## Where everything lives

| What | Where | What it does |
|---|---|---|
| Code | GitHub: `borhanrahimi/linkwell` | Every change goes through the **Checks** (`.github/workflows/ci.yml`); Dependabot opens update pull requests every Monday |
| Live site | Vercel: https://linkwell-dypu.vercel.app | Deploys every push to `main`; runs the daily link check (`vercel.json`) |
| Database | Neon: the production database, plus a dev database and a test branch | Users, folders and links |
| Sign-in | Google Cloud Console: the OAuth client for Linkwell | "Sign in with Google" |
| Uptime | UptimeRobot: the `Linkwell` monitor on `/api/health` | Emails you when the site or database is down |

## Secrets

Each one lives in `.env.local` on your computer (never in Git) and, where the
live site needs it, in **Vercel → Project → Settings → Environment Variables**.

| Name | Where it's used | Where it comes from | How to renew it |
|---|---|---|---|
| `DATABASE_URL` | `.env.local` (your dev database); Vercel (the **production** database) | Neon → project → **Connect** | Neon → **Roles** → reset the password, then update `.env.local` and Vercel, and redeploy |
| `PROD_DATABASE_URL` | `.env.local` only: production migrations and `npm run backup` | Same as Vercel's `DATABASE_URL` | Together with `DATABASE_URL` above |
| `E2E_DATABASE_URL` | `.env.local`; GitHub → Settings → Secrets → **Actions** and → **Dependabot** | Neon → the test branch → **Connect** | Neon → reset the test branch's role password, then update all three places |
| `BETTER_AUTH_SECRET` | `.env.local`; Vercel | Made up: `openssl rand -base64 32` | Make a new one and put it in Vercel. **Everyone gets signed out** (sessions are signed with it) |
| `BETTER_AUTH_URL` | `.env.local` (`http://localhost:3000`); Vercel (the live address) | Not a secret | Change it if the site's address changes (and in Google Cloud, below) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `.env.local`; Vercel | Google Cloud Console → **APIs & Services → Credentials** → Linkwell's OAuth client | Add a new client secret there, put it in Vercel and `.env.local`, redeploy, then delete the old one |
| `CRON_SECRET` | Vercel (Vercel Cron sends it to `/api/cron/check-links`); `.env.local` | Made up: `openssl rand -base64 32` | Make a new one and put it in Vercel |

GitHub's browser tests make their own throwaway `BETTER_AUTH_SECRET` and use
placeholders for Google, so they only need `E2E_DATABASE_URL`.

**If a secret leaks** (pasted somewhere public, committed by mistake): renew it
right away as above. Deleting the commit isn't enough; the old value must stop working.

## Backups

Two safety nets, for different accidents:

### 1. Neon's rewind (recent accidents)

Neon keeps the database's recent history, so it can rewind to any moment
inside its **restore window** (see Neon → project → **Settings**; on the free
plan it's short, hours to a day). Use it for "I (or a bug) just deleted or
broke data".

1. Neon → your project → **Backup & Restore** (or the production branch's **Restore**).
2. Pick the moment just **before** things went wrong.
3. Neon keeps a copy of the branch as it was before the restore, so you can
   change your mind.

### 2. Your own backup file (everything else)

For when the restore window has passed, or the Neon project itself is gone.

**Take one** (once a month, and before anything risky like a big migration):

```bash
npm run backup
```

This reads the production database (nothing changes there) and saves
`backups/linkwell-production-<date>.json`. That folder is ignored by Git, and
the file can only be read by you: it holds people's emails and links. **Copy it
somewhere else too** (an external drive, your own cloud storage), or it dies
with this computer.

It holds users, which Google account belongs to which user, folders and links.
It leaves out sign-in tokens and sessions (secrets that expire anyway: everyone
just signs in again) and rate-limit counters.

**Restore one** (only ever into an **empty** database):

1. Make an empty database: in Neon, a new project, or a new branch with
   **Schema only** ticked.
2. Create Linkwell's tables in it:
   `DATABASE_URL="<its connection string>" npx drizzle-kit migrate`
3. Put the backup in:
   `RESTORE_DATABASE_URL="<its connection string>" npm run restore -- backups/linkwell-production-<date>.json`
   It refuses any database that already has users or links, and puts
   everything in at once, or nothing.
4. To make it the live database, put its connection string in Vercel's
   `DATABASE_URL` (and `PROD_DATABASE_URL` in `.env.local`) and redeploy.

`npm run backup -- --from test` backs up the test database instead, handy
for trying all this without touching real data.
