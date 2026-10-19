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

## ✅ v0.7: Actually come back to them 🔁 (done)

- [x] "Read later" vs. "done" status for each link (Mark read / Mark unread)
- [x] A "rediscover" section that brings back old unread links (unread, saved more than a week ago, not broken, oldest first, at most 3)

**You'll learn:** derived state from dates, deterministic choices that render the same on server and browser, and product thinking around habits.

The weekly email digest is now optional (see Later / ideas): Rediscover already brings old links back whenever you open the app.

## ✅ v0.8: Folders 📁 (done)

Each link lives in one folder ("where it belongs"); tags stay for "what it's about".

- [x] A `folders` table, and a `folder_id` column on links that points to it (a foreign key)
- [x] Create, rename and delete folders (deleting a folder keeps its links, just without a folder: `ON DELETE SET NULL`)
- [x] Move a link into a folder (and out again)
- [x] Show one folder at a time, working together with the tag filter, search and sort

**You'll learn:** relationships between tables and foreign keys.

Folder names must be unique (ignoring case). We didn't need a SQL join after all: the page loads links and folders as two separate lists and matches them in the browser by `folderId`.

## ✅ v1.0: Ready for other people (done)

- [x] User accounts: Sign in with Google, see who is signed in, sign out (Better Auth)
- [x] Each user sees only their own links and folders (a `user_id` column on both)
- [x] Every Server Action checks who is asking before reading or changing data
- [x] Stop the link checker from fetching private/internal addresses (SSRF protection) before going public
- [x] Deploy to the web: live on Vercel at https://linkwell-dypu.vercel.app
- [x] Check links automatically on a schedule: Vercel Cron checks every link once a day, and the button still works
- [x] End-to-end tests in a real browser with Playwright (`npm run e2e`), against their own Neon branch

**You'll learn:** authentication, deployment, and testing.

## ✅ v1.1: A new look ✨ (done)

Redesign after launch: it's mostly styling, so the data, Server Actions and tests barely change (tests find elements by role and name, not by CSS class).

- [x] Bento grid layout: a dashboard of tiles (Save a link, Overview, Rediscover, Folders) above a grid of link cards, one column on phones and up to three on desktop
- [x] Glass cards, Apple-style: a plain light-grey background (the gradient was tried and dropped), quiet glass tiles and cards, and a floating "liquid glass" header bar that the links scroll under
- [x] Check text contrast on glass cards: a Playwright test measures every text against the real pixels behind it (WCAG AA)
- [x] Dark mode: follows the system setting, using colour tokens (`text-ink`, `bg-surface`, ...) defined once in `globals.css`; the contrast test checks both modes

**You'll learn:** CSS Grid, responsive design, visual design, and accessible colour contrast.

## ✅ v1.2: Your profile 👤 (done)

The first step toward public profiles: Linkwell knows who you are, and you choose how you're called.

- [x] Show your Google profile picture in the header (or your first letter when there's none)
- [x] An `/account` page with your picture, name, email and when you joined: the app's first second page
- [x] Choose a username (like `@borhan`): lowercase letters, numbers and `_`, unique across Linkwell, some names reserved
- [x] Export your links as a bookmarks file that Chrome and Safari can import
- [x] Delete your account (type "delete" to confirm); your links and folders go with it

**You'll learn:** routing and a second page, adding a column to Better Auth's `user` table, unique constraints, and validation shared by the browser and the server.

## ✅ v1.3: Fixes and safety 🧰 (done)

Small things to tidy up before other people sign up.

- [x] Saving a link no longer clears what you started typing while the previous link was still saving
- [x] Local development uses its own Neon branch (`dev`), so trying things out can never touch real data

**You'll learn:** race conditions in forms, and separate environments (development, test, production).

## 🔜 v1.4: Easier saving 📲

Saving should take one tap, wherever you find a link.

- [ ] Installable app (PWA) that appears in your phone's Share menu: share a page to Linkwell and it's saved
- [ ] Import bookmarks from Chrome, Safari or Firefox (the same bookmarks file format as the export in v1.2)
- [ ] Browser extension: a button that saves the current tab

**You'll learn:** web app manifests and share targets, parsing files, and browser extensions.

## v1.5: Better notes and tags 📝

- [ ] Notes on a link: "why I saved this", shown on the card and found by search
- [ ] Edit or remove the tags of a saved link

**You'll learn:** a new column end to end (schema, migration, action, UI, tests), and editing lists.

## v1.6: Our own style 🎨

Give Linkwell a personality of its own, while the app itself stays calm and minimal: hand-drawn touches in a few chosen places, not everywhere. Use our own (or properly licensed) drawings, never someone else's characters.

**Folders**
- [ ] Each folder gets a colour from a small palette and a hand-drawn icon (book, coffee cup, plane, code brackets, ...), like a sticker
- [ ] Folders look like paper folders or notebook tabs in the Folders tile

**Bookmarks**
- [ ] A hand-drawn checkmark for read links
- [ ] A doodle "snapped chain" on broken links
- [ ] Notes (from v1.5) shown as a small paper sticky note on the card

**Illustrated moments** (simple ink drawings: black lines with one or two flat colours)
- [ ] No links yet: a character holding an empty box, "Save your first link"
- [ ] No search results: a character with a magnifying glass
- [ ] Rediscover: a character with a telescope, "Remember these?"
- [ ] Sign-in screen: a friendly welcome illustration
- [ ] Account deleted (v1.2): a goodbye wave

**You'll learn:** working with SVG, a small illustration style guide (line weight, palette), adding columns for folder colour and icon, and keeping drawings readable in light and dark mode.

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

**Growing Linkwell, in this order:**

1. **A product page** for visitors who aren't signed in: what Linkwell does and why ("Actually come back to them"), screenshots, a help/FAQ section, and a download section (installable app, browser extension). Writing it means answering "why Linkwell and not Raindrop?" in one sentence
2. **Real users and their feedback:** find 10 to 20 people who keep using Linkwell every week, and learn what they miss
3. **A better layout, like Raindrop,** shaped by that feedback: a sidebar with your folders, a choice of views (cards, a compact list, or big previews), and a details panel beside the list. Take the navigation ideas, but keep what's Linkwell's own (Rediscover, coming back to links) front and centre
4. **Later, not now: a paid version (Linkwell Pro).** Only once people clearly use Linkwell and want more. A free plan with the basics, and Pro for features that cost money to run (AI summaries, archive copies, more storage), with a pricing page and payments (for example Stripe). Until then, build costly features with an on/off switch and a limit, so they're ready to become Pro

**Other ideas:**

- AI summary and tag suggestions: when a link is saved, a short summary (two sentences) appears on its card, and Linkwell suggests tags and a folder you can accept or change. Could use Claude through the Anthropic API; it costs a little per link, so it may need a limit or an on/off switch. Builds on the page fetching that already reads titles
- Keyboard shortcuts
- Fetch each page's description (and maybe a preview image) when it's saved
- Optional: a weekly email digest of forgotten links (needs the deployed app, accounts, a schedule and an email service)

## How to use this roadmap

- Work on **one milestone at a time**, top to bottom.
- Tick boxes (`- [x]`) as you finish items and commit the change.
- Ideas go into **Later / ideas** first. Move them into a milestone only once you decide to build them.
