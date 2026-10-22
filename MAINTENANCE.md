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

## Shipping a change

`main` is protected (GitHub ruleset "Protect main"): every change goes in
through a pull request whose checks passed.

```bash
git switch -c my-change           # a branch for this change
# …edit…, then:
npm run check                     # types, lint, unit tests
npm run e2e                       # browser tests (needs E2E_DATABASE_URL)
git add -A && git commit -m "What changed"
git push -u origin my-change      # Git prints a link to open a pull request
```

Open the link → **Create pull request** → wait for ✅ → **Merge pull request**
→ **Delete branch**. Vercel deploys `main` a minute or two later. Then:

```bash
git switch main && git pull
git branch -d my-change           # -d refuses unmerged work; never use -D unless you mean it
```

Every pull request also gets a Vercel **preview** address. Sign-in doesn't
work there (Google only allows the real address); that's expected.

## Running it on your computer

```bash
npm install
npm run dev                       # http://localhost:3000
```

`.env.local` holds the settings (see [Secrets](#secrets)). **After `git pull`
brings new package versions, run `npm install` and restart `npm run dev`**: a
running dev server keeps the old packages and can crash with odd errors (like
"Cannot read properties of undefined"). If it still misbehaves, `rm -rf .next`
(Next.js rebuilds it) and start again.

## Updating packages

**Every Monday** Dependabot opens pull requests: small updates grouped into one,
big (major) ones one by one. The checks test each one.

- ✅ green: merge it (one at a time). If the next one then says "out of date"
  or shows a conflict, comment `@dependabot rebase` on it and wait for ✅ again.
- ❌ red: don't merge. Usually a big upgrade needing code changes: see below.
- Afterwards: `git pull`, `npm install`, restart `npm run dev`.

**Security alerts** (Settings → Code security) arrive any day: treat them first.

### Big upgrades (a new major version)

Try them on a branch, never straight on `main`:

```bash
git switch -c upgrade-next
npm install next@latest eslint-config-next@latest   # or the package in question
npm run check && npm run e2e
```

- **Next.js**: read the upgrade guide first. The docs for the installed
  version are in `node_modules/next/dist/docs/` (this project's `AGENTS.md`
  says why: Next.js changes a lot between versions). `npx @next/codemod@latest`
  can rewrite code for some breaking changes. Run `npx next typegen` after.
- **Waiting on others**: `.github/dependabot.yml` lists majors Dependabot
  skips for now, each with the reason and when to retry. On 2026-10-21:
  TypeScript 7 and ESLint 10 (Next.js's lint setup doesn't support them yet;
  our own code passes both), and `@types/node` (follows the Node version, 22).

## Database changes (migrations)

The tables are defined in `db/schema.ts` (and `db/auth-schema.ts`).

1. Change the schema, then make a migration: `npx drizzle-kit generate --name what-changed`
2. Apply it to your dev database: `npx drizzle-kit migrate`
3. And to the test database, for the browser tests:
   `DATABASE_URL="$(grep '^E2E_DATABASE_URL=' .env.local | cut -d= -f2-)" npx drizzle-kit migrate`
4. **Before merging** the code that needs it, back up and migrate production:
   ```bash
   npm run backup
   DATABASE_URL="$(grep '^PROD_DATABASE_URL=' .env.local | cut -d= -f2-)" npx drizzle-kit migrate
   ```
   Production first, then the code: new code on an old database breaks; an
   added column on a database whose code doesn't use it yet is harmless.

## When the uptime monitor emails you

UptimeRobot opens `/api/health` every 5 minutes. It answers `{"status":"ok"}`
when the app runs **and** reaches the database.

1. Open https://linkwell-dypu.vercel.app/api/health yourself.
   - `{"status":"down"}` (503): the app runs but **the database doesn't answer**.
     Check Neon: is the project suspended, over its free limits, or is Neon
     itself having trouble (status.neon.tech)? Did `DATABASE_URL` in Vercel change?
   - No answer, or a Vercel error page: **the app is down**. Go to step 2.
2. Vercel → the project → **Deployments**. Did a deployment just go out?
   - If the trouble started with it: open the last good deployment → **⋯** →
     **Promote to Production** (instant rollback). Then fix the cause on a branch.
   - **Logs** (Vercel → the project → Logs) show the errors the server printed.
3. Vercel itself having trouble: vercel-status.com.

There is **no error tracking service** (decided 2026-10-21: it would send
error details, which can include visitors' data, to another company, and the
privacy page would need to say so). Vercel's **Logs** are where errors show
up; the uptime monitor tells you when to look.

## Setting it up from scratch

For a new computer, or rebuilding everything after losing an account.

**On your computer** (Node.js 22.12 or newer):

1. `npm install`
2. Neon: a project with three branches (production, `dev`, `e2e`; auto-delete: never). Put their connection strings in `.env.local`, **without quotes**: `DATABASE_URL` (dev), `E2E_DATABASE_URL`, `PROD_DATABASE_URL`.
3. Google Cloud Console → **APIs & Services → Credentials** → OAuth client ID (Web application). Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` and `https://linkwell-dypu.vercel.app/api/auth/callback/google`. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`.
4. Also in `.env.local`: `BETTER_AUTH_URL=http://localhost:3000`, and `BETTER_AUTH_SECRET` and `CRON_SECRET` from `openssl rand -base64 32`.
5. Create the tables on each branch: `npx drizzle-kit migrate` (dev), then the same with `DATABASE_URL` set to the test and production strings ([Database changes](#database-changes-migrations)).
6. `npm run dev`, then `npm run check` and `npm run e2e`.

**On Vercel** (it deploys every merge to `main`):

1. Import the GitHub repository. In **Settings → Environment Variables** add `DATABASE_URL` (the **production** string), `BETTER_AUTH_URL` (`https://linkwell-dypu.vercel.app`, no `/` at the end), a **new** `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and a **new** `CRON_SECRET`.
2. After changing a variable, redeploy (**Deployments → ⋯ → Redeploy**): variables are read when the app is built.
3. If Google says "Access blocked: This app's request is invalid", the live redirect URI (step 3 above) is missing.

**On GitHub:** the secret `E2E_DATABASE_URL` under **Settings → Secrets and variables → Actions** and **→ Dependabot**; the ruleset "Protect main" (pull requests and both checks required); Dependabot alerts and security updates on.

**Run the daily check by hand:** Vercel → **Settings → Cron Jobs → Run**, or locally:

```bash
curl -i -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)" http://localhost:3000/api/cron/check-links
```

## Other regular jobs

| How often | What |
|---|---|
| Daily, by itself | Vercel Cron calls `/api/cron/check-links` at 06:00 UTC: checks every link and clears old rate-limit counts |
| Weekly | Dependabot's pull requests (above) |
| Monthly | `npm run backup`, and copy the file off your computer |
| When the look changes | `npm run screenshots` retakes the landing page's pictures; commit them |
| Yearly | Check that every account still has two-factor sign-in, and that you can still sign in to GitHub, Vercel, Neon, Google Cloud and UptimeRobot |
