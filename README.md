# Linkwell

> Save links. Keep them alive. Actually come back to them.

Linkwell is a bookmark manager built with Next.js, React and Tailwind CSS. Most bookmark tools are where links go to die. Linkwell aims to keep your saved links healthy and bring them back to you.

## Status

🚧 **Early development (v0.5 done, v0.6 next).** You can add and delete links, give them an optional title and edit it later. Links are saved in a Postgres database, so they survive a refresh and are the same on every device that opens the app. Each card shows the site's icon, the full URL and when it was saved ("3 days ago"; hover for the exact date). Saving the same link twice shows an error instead. You can add tags when saving a link (comma separated, like `react, news`), and they show as `#react` `#news` under the card. Click a tag to show only the links with that tag; click it again (or "Show all") to go back. The search box finds links by URL or title as you type, and the menu next to it sorts the list by newest, oldest or title. Tag filter, search and sort all work together. If you saved links in your browser before v0.5, a banner offers to import them into the database. Next up: v0.6, which checks whether your saved links still work. There are no user accounts yet, so anyone who can open the app sees the same links. See the [roadmap](docs/ROADMAP.md).

> **Where is my data?** Links are stored in a Postgres database hosted on [Neon](https://neon.tech), in the `links` table. Links saved before v0.5 lived in your browser's `localStorage` (key `linkwell:links`). When the app finds any, it offers to import them; after importing, the browser's copy is deleted.
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
- [ ] Dead-link detection ("keep them alive")
- [ ] Resurfacing old links ("actually come back to them")

## Tech stack

| Tool | Version | Used for |
|---|---|---|
| [Next.js](https://nextjs.org) (App Router) | 16 | Framework: routing, rendering, building |
| [React](https://react.dev) | 19 | UI components |
| [TypeScript](https://www.typescriptlang.org) | 5 | Type safety |
| [Tailwind CSS](https://tailwindcss.com) | 4 | Styling |
| [Postgres](https://www.postgresql.org) on [Neon](https://neon.tech) | 18 | Database (free tier) |
| [Drizzle ORM](https://orm.drizzle.team) + drizzle-kit | 0.45 / 0.31 | Database queries in TypeScript, and migrations |
| [ESLint](https://eslint.org) | 9 | Linting |
| [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com) | 5 / 16 | Automated tests |

## Getting started

**Prerequisites:** [Node.js](https://nodejs.org) 22.12 or newer (required by Vitest), and a free [Neon](https://neon.tech) account.

```bash
# 1. Install dependencies
npm install

# 2. Create a Neon project, copy its connection string, and put it in .env.local:
#    DATABASE_URL="postgresql://..."
#    (.env.local is ignored by Git. Never commit it.)

# 3. Create the tables in your database
npx drizzle-kit migrate

# 4. Start the dev server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the dev server with hot reload |
| `npm run build` | Builds the app for production |
| `npm run start` | Runs the production build (run `build` first) |
| `npm run lint` | Checks the code with ESLint |
| `npm test` | Runs the tests in watch mode (re-runs on every save) |
| `npm run check` | Type-check + lint + tests, once. **Run before every commit.** |
| `npx drizzle-kit generate --name <change>` | Writes a new SQL migration in `drizzle/` after you change `db/schema.ts` |
| `npx drizzle-kit migrate` | Applies new migrations to the database in `DATABASE_URL` |

## Project structure

```
linkwell/
├── app/              # Routes: pages, layouts and Server Actions (Next.js App Router)
│   ├── layout.tsx    # Root layout wrapping every page
│   ├── globals.css   # Global styles (Tailwind)
│   ├── page.tsx      # Home page (Server Component): reads links from the database
│   └── actions.ts    # Server Actions: save, delete and edit links
├── components/       # UI components (LinkManager, LinkForm, LinkCard, ImportBanner)
├── lib/
│   ├── data.ts       # Database reads and writes (server-only)
│   └── links.ts      # Pure helpers: creating, filtering, sorting, formatting links
├── db/               # Database connection and table schema (Drizzle)
├── drizzle/          # Generated SQL migrations (committed)
├── types/          # Shared TypeScript types (Link)
├── __tests__/      # Automated tests (Vitest)
├── docs/           # Architecture and roadmap
└── public/           # Static files served as-is (empty for now)
```

For how these pieces fit together and the rules for where new code goes, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md): how the code is organized and why
- [Roadmap](docs/ROADMAP.md): what's planned next
