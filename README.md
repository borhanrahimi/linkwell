# Linkwell

> Save links. Keep them alive. Actually come back to them.

Linkwell is a bookmark manager built with Next.js, React and Tailwind CSS. Most bookmark tools are where links go to die. Linkwell aims to keep your saved links healthy and bring them back to you.

## Status

🚧 **Early development (v1.1 done).** You can add and delete links, give them an optional title and edit it later. If you leave the title empty, Linkwell reads it from the page itself. Links are saved in a Postgres database, so they survive a refresh and are the same on every device that opens the app. The look is minimal and Apple-style: a plain light-grey page, glass tiles and cards, pill-shaped buttons, the system font (San Francisco on Apple devices), and a floating glass header bar that stays at the top while your links scroll underneath. Dark mode follows your device's setting (on a Mac: System Settings → Appearance). The page is a bento grid: tiles on top for saving a link, an **Overview** (how many links are saved, unread and broken), Rediscover and folders, and your links as a grid of cards below (one column on phones, up to three on desktop). Each card shows the site's icon, the full URL and when it was saved ("3 days ago"; hover for the exact date). Saving the same link twice shows an error instead. You can add tags when saving a link (comma separated, like `react, news`), and they show as `#react` `#news` under the card. Click a tag to show only the links with that tag; click it again (or "Show all") to go back. The search box finds links by URL or title as you type, and the menu next to it sorts the list by newest, oldest or title. Tag filter, search and sort all work together. If you saved links in your browser before v0.5, a banner offers to import them into the database. The **Check links** button visits every saved link from the server and marks dead ones with a red **Broken** badge (hover it to see when it was checked). A link only counts as broken when the page is gone (404/410), the domain doesn't exist, or nothing answers; slow sites, sites that block robots, and temporary errors count as working. Broken links get a **View archived copy** link to the Wayback Machine. Mark links as read when you're done with them (read links get a grey title and a **Read** label). A violet **Rediscover** box at the top brings back up to three links you saved more than a week ago and still haven't read. You can also sort links into folders: **+ New folder** creates one, the menu on each card moves a link into a folder (or back to "No folder"), and clicking a folder shows only its links, together with the tag filter, search and sort. A selected folder can be renamed or deleted; deleting a folder keeps its links, they just leave the folder. Next up: v1.0, getting Linkwell ready for other people. Done so far: the server refuses to fetch private or internal addresses (like `localhost`) when checking links or reading titles, and such links count as broken. You now sign in with Google to use the app; the page shows who is signed in and has a **Sign out** button. Each account has its own links and folders: nobody else can see or change yours. Linkwell is online at [linkwell-dypu.vercel.app](https://linkwell-dypu.vercel.app). Every link is also checked automatically once a day, and browser tests (Playwright) check signing in, saving links and keeping accounts apart. v1.1 (the new look) is done; see the roadmap for what could come next. See the [roadmap](docs/ROADMAP.md).

> **Where is my data?** Links are stored in a Postgres database hosted on [Neon](https://neon.tech), in the `links` and `folders` tables. Links saved before v0.5 lived in your browser's `localStorage` (key `linkwell:links`). When the app finds any, it offers to import them; after importing, the browser's copy is deleted.
>
> **Favicons:** site icons are loaded from Google's favicon service (`www.google.com/s2/favicons`), so Google sees the *domain* of each saved link (not the full URL) when the icons load.

## Features

- [x] Save a link
- [x] Delete a link
- [x] Links survive a page refresh
- [x] Optional title for each link (shows the domain when there's none)
- [x] The same link can't be saved twice
- [x] Edit a link's title (Enter saves, Escape cancels)
- [x] Site icon (favicon) next to each link
- [x] Friendly dates ("3 days ago")
- [x] Tags on each link
- [x] Filter by tag
- [x] Search by URL or title
- [x] Sort by newest, oldest or title
- [x] Links saved in a database, the same on every device
- [x] Import links saved in the browser before v0.5
- [x] Dead-link detection with a "Check links" button and a Broken badge ("keep them alive")
- [x] Archived copies of broken links (Wayback Machine)
- [x] Page titles filled in automatically
- [x] Read / unread status for each link
- [x] Rediscover old unread links ("actually come back to them")
- [x] Folders (each link in one folder)
- [x] Bento grid layout with an Overview tile (saved, unread and broken counts)
- [x] Minimal Apple-style look: glass cards and a liquid glass header, with every text checked for readable contrast
- [x] Dark mode (follows the system setting)
- [x] Sign in with Google and sign out
- [x] Each account has its own links and folders

## Tech stack

| Tool | Version | Used for |
|---|---|---|
| [Next.js](https://nextjs.org) (App Router) | 16 | Framework: routing, rendering, building |
| [React](https://react.dev) | 19 | UI components |
| [TypeScript](https://www.typescriptlang.org) | 5 | Type safety |
| [Tailwind CSS](https://tailwindcss.com) | 4 | Styling |
| [Postgres](https://www.postgresql.org) on [Neon](https://neon.tech) | 18 | Database (free tier) |
| [Drizzle ORM](https://orm.drizzle.team) + drizzle-kit | 0.45 / 0.31 | Database queries in TypeScript, and migrations |
| [Better Auth](https://better-auth.com) | 1 | Sign in with Google, sessions |
| [ESLint](https://eslint.org) | 9 | Linting |
| [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com) | 5 / 16 | Automated tests |
| [Playwright](https://playwright.dev) | 1.64 | End-to-end tests in a real browser |

## Getting started

**Prerequisites:** [Node.js](https://nodejs.org) 22.12 or newer (required by Vitest), and a free [Neon](https://neon.tech) account.

```bash
# 1. Install dependencies
npm install

# 2. Create a Neon project, copy its connection string, and put it in .env.local:
#    DATABASE_URL="postgresql://..."
#    (.env.local is ignored by Git. Never commit it.)

# 3. Add the sign-in settings to .env.local too:
#    BETTER_AUTH_URL=http://localhost:3000
#    BETTER_AUTH_SECRET=...      # any random string: openssl rand -base64 32
#    GOOGLE_CLIENT_ID=...        # from Google Cloud Console → APIs & Services →
#    GOOGLE_CLIENT_SECRET=...    #   Credentials → OAuth client ID (Web application)
#    In Google Cloud, set the authorized redirect URI to
#    http://localhost:3000/api/auth/callback/google
#    For the browser tests (npm run e2e), also add a Neon branch's connection string:
#    E2E_DATABASE_URL=...         # Neon → Branches → Create branch "e2e" (auto-delete: never)

# 4. Create the tables in your database
npx drizzle-kit migrate

# 5. Start the dev server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Deploying

Linkwell runs on [Vercel](https://vercel.com). Every push to `main` deploys automatically.

1. In the Vercel project, open **Settings → Environment Variables** and add the same five variables as in `.env.local`, with two changes:
   - `BETTER_AUTH_URL` is the live address (`https://linkwell-dypu.vercel.app`, no `/` at the end)
   - `BETTER_AUTH_SECRET` is a new random string, not the local one
   - `CRON_SECRET` is a new random string too (it protects the daily link check)
2. In Google Cloud Console, add `https://linkwell-dypu.vercel.app/api/auth/callback/google` to the OAuth client's **Authorized redirect URIs**. If this is missing, Google shows "Access blocked: This app's request is invalid".
3. After changing a variable, redeploy (**Deployments → ⋯ → Redeploy**), because variables are read when the app is built.

Run new database migrations (`npx drizzle-kit migrate`) before pushing code that needs them. The live site uses the same Neon database as local development.

**Daily link check:** `vercel.json` tells Vercel Cron to call `/api/cron/check-links` every day at 06:00 UTC. Vercel sends `CRON_SECRET` with the request, and the route refuses any request without it. To run the check by hand, use **Settings → Cron Jobs → Run** in Vercel, or locally:

```bash
curl -i -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)" http://localhost:3000/api/cron/check-links
```

Write `CRON_SECRET` in `.env.local` without quotes, or this command sends them along and gets `401`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the dev server with hot reload |
| `npm run build` | Builds the app for production |
| `npm run start` | Runs the production build (run `build` first) |
| `npm run lint` | Checks the code with ESLint |
| `npm test` | Runs the tests in watch mode (re-runs on every save) |
| `npm run check` | Type-check + lint + tests, once. **Run before every commit.** |
| `npm run e2e` | Builds the app and runs the Playwright browser tests against the test database (`E2E_DATABASE_URL`). `npx playwright show-report` shows what went wrong |
| `npx drizzle-kit generate --name <change>` | Writes a new SQL migration in `drizzle/` after you change `db/schema.ts` |
| `npx drizzle-kit migrate` | Applies new migrations to the database in `DATABASE_URL` |

## Project structure

```
linkwell/
├── app/              # Routes: pages, layouts and Server Actions (Next.js App Router)
│   ├── layout.tsx    # Root layout wrapping every page
│   ├── globals.css   # Global styles (Tailwind)
│   ├── page.tsx      # Home page (Server Component): sign-in screen, or the links from the database
│   ├── actions.ts    # Server Actions: save, delete, edit, import and check links; manage folders
│   └── api/auth/     # Better Auth's sign-in, callback and sign-out endpoints
├── components/       # UI components (LinkManager, LinkForm, LinkCard, ImportBanner, CheckLinksButton, Overview, Rediscover, FolderBar, FolderActions, SignInButton, SignOutButton)
├── lib/
│   ├── auth.ts       # Better Auth setup: Google sign-in, sessions in Postgres (server-only)
│   ├── auth-client.ts # Better Auth for the browser (sign in, sign out)
│   ├── session.ts    # getUserId(): who is signed in, for the Server Actions
│   ├── checkLink.ts  # Visits a URL and decides if it's "ok" or "broken"
│   ├── safeUrl.ts    # SSRF protection: safeFetch refuses private/internal addresses
│   ├── fetchTitle.ts # Reads a page's <title> when a link is saved without one
│   ├── data.ts       # Database reads and writes (server-only)
│   └── links.ts      # Pure helpers: creating, filtering, sorting, formatting links
├── db/               # Database connection and table schema (Drizzle); auth-schema.ts holds the account tables
├── drizzle/          # Generated SQL migrations (committed)
├── types/          # Shared TypeScript types (Link, Folder)
├── __tests__/      # Automated tests (Vitest)
├── e2e/            # Browser tests (Playwright); fixtures.ts signs in test users without Google, contrast.ts measures text contrast
├── docs/           # Architecture and roadmap
└── public/           # Static files served as-is (empty for now)
```

For how these pieces fit together and the rules for where new code goes, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md): how the code is organized and why
- [Roadmap](docs/ROADMAP.md): what's planned next
