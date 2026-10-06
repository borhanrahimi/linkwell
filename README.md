# Linkwell

> Save links. Keep them alive. Actually come back to them.

Linkwell is a bookmark manager built with Next.js, React and Tailwind CSS. Most bookmark tools are where links go to die. Linkwell aims to keep your saved links healthy and bring them back to you.

## Status

🚧 **Early development (v0.3 done).** You can add and delete links, give them an optional title and edit it later, and they're saved in your browser, so they survive a refresh. Each card shows the site's icon, the full URL and when it was saved ("3 days ago"; hover for the exact date). Saving the same link twice shows an error instead. Links don't sync between devices yet. Next up: v0.4, tags, filtering, search and sorting. See the [roadmap](docs/ROADMAP.md).

> **Where is my data?** Links are stored in your browser's `localStorage` under the key `linkwell:links`. They stay on this computer and in this browser only. Clearing your browser's site data deletes them.
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
- [ ] Tags and search
- [ ] Dead-link detection ("keep them alive")
- [ ] Resurfacing old links ("actually come back to them")

## Tech stack

| Tool | Version | Used for |
|---|---|---|
| [Next.js](https://nextjs.org) (App Router) | 16 | Framework: routing, rendering, building |
| [React](https://react.dev) | 19 | UI components |
| [TypeScript](https://www.typescriptlang.org) | 5 | Type safety |
| [Tailwind CSS](https://tailwindcss.com) | 4 | Styling |
| [ESLint](https://eslint.org) | 9 | Linting |
| [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com) | 5 / 16 | Automated tests |

## Getting started

**Prerequisites:** [Node.js](https://nodejs.org) 22.12 or newer (required by Vitest).

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
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

## Project structure

```
linkwell/
├── app/            # Routes only: pages and layouts (Next.js App Router)
│   ├── layout.tsx  # Root layout wrapping every page
│   ├── globals.css # Global styles (Tailwind)
│   └── page.tsx    # Home page: holds the links state, composes components
├── components/     # Reusable UI components (LinkForm, LinkCard)
├── lib/            # Non-UI logic: creating, formatting, saving and loading links
├── types/          # Shared TypeScript types (Link)
├── __tests__/      # Automated tests (Vitest)
├── docs/           # Architecture and roadmap
└── public/         # Static files served as-is (empty for now)
```

For how these pieces fit together and the rules for where new code goes, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md): how the code is organized and why
- [Roadmap](docs/ROADMAP.md): what's planned next
