# Linkwell

> Save links. Keep them alive. Actually come back to them.

Linkwell is a bookmark manager built with Next.js, React and Tailwind CSS. Most bookmark tools are where links go to die. Linkwell aims to keep your saved links healthy and bring them back to you.

## Status

🚧 **Early development (v0.1).** You can add and delete links, but they are only kept in memory and **disappear when you refresh the page**. Saving links is the next milestone. See the [roadmap](docs/ROADMAP.md).

## Features

- [x] Save a link
- [x] Delete a link
- [ ] Links survive a page refresh
- [ ] Titles and descriptions for links
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

## Getting started

**Prerequisites:** [Node.js](https://nodejs.org) 20 or newer.

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
| `npx tsc --noEmit` | Type-checks the code without building |

## Project structure

```
linkwell/
├── app/            # Routes only: pages and layouts (Next.js App Router)
│   ├── layout.tsx  # Root layout wrapping every page
│   └── page.tsx    # Home page: holds the links state, composes components
├── components/     # Reusable UI components (LinkForm, LinkCard)
├── lib/            # Non-UI logic: helpers, data access (empty for now)
├── types/          # Shared TypeScript types (Link)
├── docs/           # Architecture and roadmap
└── public/         # Static files served as-is
```

For how these pieces fit together and the rules for where new code goes, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md): how the code is organized and why
- [Roadmap](docs/ROADMAP.md): what's planned next
