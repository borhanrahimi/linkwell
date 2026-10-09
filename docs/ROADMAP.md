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

## ✅ v0.3: Better links (done)

- [x] Optional title for each link (fall back to the domain name)
- [x] Stop the same URL from being saved twice
- [x] Edit a link's title
- [x] Show the site's favicon next to each link
- [x] Friendlier dates ("3 days ago")
- [x] Replace leftover Create Next App settings: the browser tab title in `app/layout.tsx`, and the unused Geist font (or switch `globals.css` to use it)

**You'll learn:** form validation, editing state, and small pure functions in `lib/`.

## ✅ v0.4: Organize and find (done)

- [x] Add tags to links
- [x] Filter the list by tag
- [x] Search by URL or title
- [x] Sort by newest, oldest or title
- [x] Click the selected tag again to clear the filter

**You'll learn:** derived state (computing the visible list from state plus filters, without storing it twice).

## ✅ v0.5: A real backend (done)

Moves data from the browser to a server, so links follow you across devices.

- [x] Pick a database and record the decision in `docs/ARCHITECTURE.md` (Postgres on Neon, with Drizzle)
- [x] Read links in a Server Component, so `page.tsx` no longer needs `"use client"`
- [x] Add, edit and delete links with Server Actions
- [x] Move storage to the database (`lib/data.ts`), keeping `lib/links.ts` for pure helpers
- [x] Import links saved in `localStorage` before v0.5 into the database (a banner offers it once)
- [x] Remove the leftover `localStorage` writing code (`saveLinks` → `clearSavedLinks`)

**You'll learn:** Server vs. Client Components, Server Actions, databases and migrations, hydration, and faking modules in tests (`vi.mock`).

## ✅ v0.6: Keep them alive 🩺 (done)

- [x] Fetch each link's page title automatically when it's saved without one
- [x] Check whether saved links still work (dead-link detection, with a "Check links" button)
- [x] Show a "broken" badge on dead links
- [x] Offer an archived copy (from the Wayback Machine) for dead links

**You'll learn:** server-side fetching, timeouts, error handling, schema changes, and faking the network in tests.

Scheduled (automatic) link checks moved to v1.0: they need the app to be deployed, so something can wake it up every day.

## 🔜 v0.7: Actually come back to them 🔁

- [x] "Read later" vs. "done" status for each link (Mark read / Mark unread)
- [ ] A "rediscover" section that brings back old unread links
- [ ] Weekly digest of forgotten links (email or in-app)

**You'll learn:** scheduled jobs and product thinking around habits.

## v0.8: Folders 📁

Each link lives in one folder ("where it belongs"); tags stay for "what it's about".

- [ ] A `folders` table, and a `folder_id` column on links that points to it (a foreign key)
- [ ] Create, rename and delete folders (decide what happens to a deleted folder's links: `ON DELETE`)
- [ ] Move a link into a folder (and out again)
- [ ] Show one folder at a time, working together with the tag filter, search and sort

**You'll learn:** relationships between tables, foreign keys, and joins.

## v1.0: Ready for other people

- [ ] User accounts (sign up and log in)
- [ ] Each user sees only their own links (add a `user_id` column)
- [ ] Every Server Action checks who is asking before reading or changing data
- [ ] Stop the link checker from fetching private/internal addresses (SSRF protection) before going public
- [ ] Deploy to the web (for example Vercel)
- [ ] Check links automatically on a schedule (for example Vercel Cron), instead of only with the button
- [ ] End-to-end tests in a real browser (for example Playwright)

**You'll learn:** authentication, deployment, and testing.

## v1.1: A new look ✨

Redesign after launch: it's mostly styling, so the data, Server Actions and tests barely change (tests find elements by role and name, not by CSS class).

- [ ] Bento grid layout: cards in a CSS Grid with different tile sizes (for example bigger tiles for rediscover and broken links), working on phone and desktop
- [ ] Glassmorphism cards: frosted glass (`backdrop-blur`, see-through backgrounds, light borders) over a gradient background
- [ ] Check text contrast on glass cards so everything stays readable and accessible
- [ ] Dark mode

**You'll learn:** CSS Grid, responsive design, visual design, and accessible colour contrast.

---

## 🔭 Long-term vision: Linkwell goes social

Not a milestone yet: a direction for after v1.1. Linkwell stays a **private** tool first; sharing is always something you choose, never the default. Builds on folders (v0.8) and accounts (v1.0).

1. **Share a folder publicly:** one public link to a folder, readable by anyone, nothing else social yet (the natural first step)
2. **Collaborative folders:** share a folder with a friend who can add links too
3. **Public profiles:** a page like `/@username` with your name, photo and the folders you chose to make public (folders become boards, like on Pinterest)
4. **Follow people and a feed:** follow someone, and see the newest public links from people you follow
5. **Likes and "save to my Linkwell":** like a link, or copy someone's link into one of your own folders
6. **Discover page:** popular public folders and links
7. **Safety:** report and remove spam or harmful links, block users. Needed before strangers can see each other's content

**You'll learn:** dynamic routes (`app/[username]/page.tsx`), permissions (who may see what), many-to-many tables (`follows`), feeds and pagination, unique constraints (no double likes), and the product side of running a community.

---

## Later / ideas

Not planned yet, but worth remembering:

- Browser extension to save the current tab
- Import bookmarks from Chrome or Firefox
- Edit or remove the tags of a saved link
- Keyboard shortcuts
- Fetch each page's description (and maybe a preview image) when it's saved
- Share to Linkwell from your phone: make the site an installable app (PWA) so it appears in the phone's Share menu
- Notes on a link: "why I saved this" (nice to have)

## How to use this roadmap

- Work on **one milestone at a time**, top to bottom.
- Tick boxes (`- [x]`) as you finish items and commit the change.
- Ideas go into **Later / ideas** first. Move them into a milestone only once you decide to build them.
