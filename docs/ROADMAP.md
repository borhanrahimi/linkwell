# Roadmap

Linkwell's tagline gives it three promises, and this roadmap is built around them:

1. **Save links**: saving is fast and links never get lost.
2. **Keep them alive**: Linkwell notices when a link breaks.
3. **Actually come back to them**: Linkwell brings old links back to you.

Each milestone is small enough to finish and ship on its own. The **"You'll learn"** line says which new skill the milestone teaches.

---

## ✅ v0.1: Foundation (done)

- [x] Add and delete links
- [x] Split UI into `LinkForm` and `LinkCard` components
- [x] Shared `Link` type in `types/`
- [x] README, architecture doc, roadmap
- [x] Automated tests with Vitest (`npm run check`)

## ✅ v0.2: Links survive a refresh (done)

Links used to disappear when you reloaded the page. Now they're saved in the browser's `localStorage`.

- [x] Create `lib/links.ts` with `createLink(url)`
- [x] Use `crypto.randomUUID()` for IDs instead of `Date.now()`, so two quick saves can't share an ID
- [x] Store `createdAt` as an ISO string and format it only when displaying it
- [x] Add `loadLinks()` and `saveLinks(links)` to `lib/links.ts`, using `localStorage` (with tests)
- [x] Load saved links when the page opens (`useEffect`), save on add/delete (with tests)

**You'll learn:** `useEffect`, browser storage, and keeping data access in `lib/`.

## 🔜 v0.3: Better links

- [x] Optional title for each link (fall back to the domain name)
- [x] Stop the same URL from being saved twice
- [x] Edit a link's title
- [x] Show the site's favicon next to each link
- [ ] Friendlier dates ("3 days ago")
- [x] Replace leftover Create Next App settings: the browser tab title in `app/layout.tsx`, and the unused Geist font (or switch `globals.css` to use it)

**You'll learn:** form validation, editing state, and small pure functions in `lib/`.

## v0.4: Organize and find

- [ ] Add tags to links
- [ ] Filter the list by tag
- [ ] Search by URL or title
- [ ] Sort by newest, oldest or title

**You'll learn:** derived state (computing the visible list from state plus filters, without storing it twice).

## v0.5: A real backend

Moves data from the browser to a server, so links follow you across devices.

- [ ] Pick a database (for example SQLite or Postgres) and record the decision in `docs/ARCHITECTURE.md`
- [ ] Read links in a Server Component, so `page.tsx` no longer needs `"use client"`
- [ ] Add, edit and delete links with Server Actions
- [ ] Rewrite `lib/links.ts` to talk to the database. Components shouldn't need to change.

**You'll learn:** Server vs. Client Components, Server Actions, and databases.

## v0.6: Keep them alive 🩺

- [ ] Fetch each link's page title and description automatically when it's saved
- [ ] Check whether saved links still work (dead-link detection)
- [ ] Show a "broken" badge on dead links
- [ ] Offer an archived copy (for example from the Wayback Machine) for dead links

**You'll learn:** server-side fetching, background jobs, and error handling.

## v0.7: Actually come back to them 🔁

- [ ] "Read later" vs. "done" status for each link
- [ ] A "rediscover" section that brings back old unread links
- [ ] Weekly digest of forgotten links (email or in-app)

**You'll learn:** scheduled jobs and product thinking around habits.

## v1.0: Ready for other people

- [ ] User accounts (sign up and log in)
- [ ] Each user sees only their own links
- [ ] Deploy to the web (for example Vercel)
- [ ] End-to-end tests in a real browser (for example Playwright)

**You'll learn:** authentication, deployment, and testing.

---

## Later / ideas

Not planned yet, but worth remembering:

- Browser extension to save the current tab
- Import bookmarks from Chrome or Firefox
- Share a collection of links publicly
- Dark mode
- Keyboard shortcuts

## How to use this roadmap

- Work on **one milestone at a time**, top to bottom.
- Tick boxes (`- [x]`) as you finish items and commit the change.
- Ideas go into **Later / ideas** first. Move them into a milestone only once you decide to build them.
