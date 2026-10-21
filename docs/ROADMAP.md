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

## ✅ v1.4: Easier saving 📲 (done)

Saving should take one tap, wherever you find a link. Every way of saving opens the same page, `/share?url=...&title=...`, which shows a small save card.

- [x] A `/share` page that every saving tool opens: it finds the link (in `url`, or inside `text`), asks you to sign in first if needed (and brings you back), and saves only after you click **Save link**
- [x] Bookmarklet: a "Save to Linkwell" button on the account page that you drag to your bookmarks bar
- [x] Browser extension (Chrome, Edge, Brave, Arc): a toolbar button next to the ⭐, or Alt+Shift+S, in `extension/`. Installed with "Load unpacked" for now; not on the Chrome Web Store yet
- [x] iPhone: a "Save to Linkwell" Shortcut in the Share menu (built in the Shortcuts app, no code), and "Add to Home Screen" to use Linkwell like an app
- [x] Installable app (PWA, `app/manifest.ts`): on Android, the installed app appears in the Share menu (`share_target`)
- [x] A **Paste** button next to the link box (the easiest way on an iPhone: copy a link anywhere, open Linkwell, tap Paste). Only shown where the browser can read the clipboard
- [x] Import bookmarks from Chrome, Safari, Firefox or Raindrop (the same bookmarks file format as the export in v1.2): browser folders become Linkwell folders, tags come along, links you already have are skipped, and you see a preview ("Found 248 links in 12 folders") before anything is saved

**You'll learn:** web app manifests and share targets, bookmarklets, browser extensions (Manifest V3), redirecting back after sign-in, the Clipboard API and `useSyncExternalStore`, reading files in the browser (`DOMParser`), sending big imports in batches, and one-state-at-a-time screens with a union type.

Later, once real people use Linkwell:
- Share the iPhone Shortcut as an iCloud link on the account page, so nobody has to build it
- Publish the extension on the Chrome Web Store (a one-time $5 fee and a review), and maybe Safari (needs Xcode and an Apple developer account)

## ✅ v1.5: Better notes and tags 📝 (done)

- [x] Notes on a link: "why I saved this", shown on the card and found by search
- [x] Edit or remove the tags of a saved link (one Edit form for title, tags and note)

**You'll learn:** a new column end to end (schema, migration, action, UI, tests), and editing lists.

## ✅ v1.6: Our own style 🎨 (done)

Give Linkwell a personality of its own, while the app itself stays calm and minimal: hand-drawn touches in a few chosen places, not everywhere. Use our own (or properly licensed) drawings, never someone else's characters.

**Folders**
- [x] Each folder gets a colour from a small palette (Apple's 8 system colours, with dark-mode shades), shown as a dot on its pill. New folders take the next colour; pick another under the folder bar
- [x] A hand-drawn icon instead of the dot: 12 to choose from (book, coffee, plane, code, music, heart, star, briefcase, home, cart, camera, leaf), drawn in the folder's colour
- [x] Folders look like notebook tabs in the Folders tile: a strip of the folder colour on top, standing on a line, and the open tab joins the page with its settings

**Bookmarks**
- [x] A hand-drawn checkmark for read links, in green in the Read label
- [x] A doodle "snapped chain" on broken links, in the red Broken badge
- [x] Notes (from v1.5) shown as a small paper sticky note on the card: paper colour, a slight tilt and a strip of tape

**Illustrated moments** (minimal character line art, black and white for now). Every drawing stars the same **Linkwell character, drawn after Linkwell's creator**: curly black hair, square black glasses, a moustache, stubble and a black T-shirt
- [x] No links yet: holding up an open, empty box, with a bookmark floating down
- [x] No search results: a magnifying glass making one eye huge, and question marks
- [x] Rediscover: "Remember these?", peering through a spyglass at a bookmark among the stars
- [x] Sign-in screen: waving hello
- [x] Account deleted (v1.2): waving goodbye while a paper plane flies off

**Illustration style guide** (so every drawing looks like it belongs to the same app):
- Our own drawings, written as SVG in `components/illustrations/` (one component per drawing) and `components/FolderIcon.tsx`. The character's parts (`Head`, `Tee`, `Legs`, `Limb`, `Hand`, `Shoe`) and shared bits (`Shaded`, `Shadow`, `Bubble`, `Sparkle`, `Bookmark`, `Heart`, `ChainLink`, the `Drawing` frame) live in `components/illustrations/Character.tsx`, so every scene shows the same person
- **Since v1.9: loose pen doodles, like sketches in a notebook.** Full-body people doing something, with stick arms and legs, round mitten hands, little black shoes and a soft grey shadow under the feet. Speech bubbles for what they say or think ("Hi!", "?", a tick)
- Thin ink lines in `currentColor` (`text-ink`, about 1.7 units on a 160×120 drawing), round ends and joins, with a little hand wobble: the `Drawing` frame runs every line through an SVG filter (`feTurbulence` + `feDisplacementMap`), so straight lines look drawn by hand
- **Black, white and grey marker only**: ink lines, `fill-surface` (the paper) where shapes overlap, and two marker greys (`fill-marker`, `fill-marker-strong` for the dark T-shirt). `Shaded` puts the grey slightly off the outline, like a quick marker stroke. All swap in dark mode, where it looks like chalk on a blackboard. Small UI doodles (folder icons, the snapped chain) may use the colour of what they sit on
- Decoration only: `aria-hidden="true"`, and the words around it still say everything. Hidden on phones when it would squeeze the text

**You'll learn:** working with SVG, a small illustration style guide (line weight, palette), adding columns for folder colour and icon, and keeping drawings readable in light and dark mode.


## ✅ v1.7: Safety before strangers 🔒 (done)

Before the landing page invites strangers in, lock the doors. Already done: every Server Action checks who is asking, the link checker refuses private addresses (SSRF), the daily check needs a secret, and deleting an account needs a recent sign-in.

**Check what's sent to the server** (gaps found in the code)
- [x] `saveLink` accepts any address and any length: now only `http`/`https` links (no `javascript:`, `data:` or `file:`), with limits on the URL (2048), title (500) and tags (20, of 50 characters each), a real UUID as id, and only the fields a new link may have (`cleanNewLink`)
- [x] `importLinks` (the old localStorage import) uses the same checks, saves in one INSERT, and refuses more than 1000 links at once
- [x] Folder names get a 100-character limit when created or renamed (`cleanFolderName`); the Edit form's title is limited too, and odd input (numbers, objects) can't crash an action

**Limits, so one person can't overload Linkwell**
- [x] Rate limits on the expensive actions (`lib/limits.ts`): saving a link 30 a minute, "Check links" 5 an hour, bookmark import 100 batches an hour, the old import 5 an hour. Counted in a `rate_limits` table in Postgres (in-memory counters don't work on serverless); the daily cron job deletes old counts
- [x] At most 10,000 links and 200 folders per account. Imports stop at the limit (the rest count as skipped); past the folder limit, imported links come in without a folder

**Browser protection**
- [x] Security headers: a Content-Security-Policy with a fresh nonce for every page (`proxy.ts`, `lib/csp.ts`), so only Linkwell's own scripts run; plus, on every response (`next.config.ts`): no showing Linkwell inside other sites, no guessing file types, a strict referrer policy, HTTPS only, and no camera, microphone or location

**Housekeeping**
- [x] Fix what `npm audit` reports: `vite` updated, `drizzle-kit`'s old `esbuild` replaced with an `overrides` entry. Left: `braces` (through ESLint), which has no fix yet and only reads our own lint patterns
- [x] A `SECURITY.md` (report problems privately through GitHub), and a security checklist in ARCHITECTURE.md to go through for every new feature

**You'll learn:** validating input on the server, rate limiting, security headers and CSP, and keeping dependencies safe.

## 🔜 v1.8: The landing page 🏠 (in progress)

Signed-out visitors see only a small sign-in card today. Give them a real welcome.

- [x] A landing page (`components/Landing.tsx`): the promise in one line, three cards for the three promises (save, keep alive, come back), each with a drawing of the Linkwell character, and a clear **Sign in with Google** button
- [ ] Real screenshots of the app on the landing page (after v1.9, so they show the new layout)
- [x] "Save from anywhere" for newcomers: any browser (bookmarklet), your phone, copy and paste, importing old bookmarks. The extension is left out until it's published
- [x] No other companies' or products' names in what users see: neutral words like "your browser", "your phone" and "other bookmark apps"
- [x] A short FAQ: Is it free? Who can see my links? Can I take them with me? How is it different from other bookmark apps? Is it safe? (`<details>`, no JavaScript)
- [x] Privacy policy and terms pages (`/privacy`, `/terms`) in plain language, linked from the landing page, the account page and next to the sign-in button. Google needs them before sign-in can leave "testing" mode for everyone
- [ ] A contact email for privacy questions (`SITE.contactEmail` in `lib/site.ts`)
- [x] Sharing previews: page titles ("Privacy · Linkwell"), a description, and a 1200×630 preview picture (`app/opengraph-image.png`: the icon, the promise and the Linkwell character waving) for when someone shares the link in a chat
- [x] A new drawing for "Keep them alive": the character as a doctor, listening to Linkwell's chain link with a stethoscope (`LinkDoctor`)

**You'll learn:** marketing pages vs. app pages, metadata and Open Graph images, and writing for people who don't know Linkwell yet.

## 🔜 v1.9: A better layout 🗂️ (in progress)

As the list of links grows, the dashboard tiles get in the way: you scroll past them every time, and folders, tags and counts live in different places. Give Linkwell the layout of a real app, while keeping what's Linkwell's own (Rediscover, coming back to links) front and centre.

```
┌───────────────────────────────────────────────────────────────────────┐
│ Linkwell        [ Paste a link…                     ] [Save]  👤 @you │
├──────────────┬────────────────────────────────────────┬───────────────┤
│ All links  48│ 🔭 Remember these? (Rediscover)        │ Details       │
│ Unread     12│ [Search…]   Sort ▾    [▦ Cards][≡ List] │ Title         │
│ Broken      2│ ┌──────┐ ┌──────┐ ┌──────┐             │ example.com   │
│              │ │ card │ │ card │ │ card │             │ Note …        │
│ FOLDERS      │ └──────┘ └──────┘ └──────┘             │ #tags         │
│ 📖 Reading  9│   … or one compact row per link        │ Folder ▾      │
│ ☕ Recipes  4│                                        │ Saved, checked│
│ + New folder │                                        │ [Edit][Delete]│
│ TAGS         │                                        │               │
│ #react #news │                                        │               │
└──────────────┴────────────────────────────────────────┴───────────────┘
```

**Step 1: the top bar**
- [x] The save box moves into the top bar, always there, next to the account menu. Title and tags fold out in a second row once a link is typed, so the bar stays slim; on phones the save box gets its own row inside the bar

**Step 2: the sidebar**
- [x] Smart lists with counts: All links, Unread, Broken (replacing the Overview tile; the numbers become filters), with Check links under them
- [x] Folders with their colours and icons, their link counts, and "+ New folder" (replacing the notebook tabs). The chosen folder's name heads the list, with its icon, colour, rename and delete under it
- [x] Tags, as filters (most used first, with counts); a tag combines with a smart list or a folder

**Step 3: views**
- [x] A choice of Cards (today's grid) or List (one compact row per link: title, badges, site, date, tags and actions), remembered per device in `localStorage`
- [x] Search, sort and the view switch together in one toolbar above the list (search gets its own row on phones)

**Step 4: the details panel**
- [x] **Details** on any card or row opens everything about the link beside the list (full address, note, saved, read and last-checked dates, folder, tags, archive link) with Mark read, Edit and Delete. A third column on wide screens, a full-screen sheet on smaller ones; Close or Esc closes it, and focus moves into it when it opens

**Step 5: drawings, Rediscover, phones and polish**

Drawings first:
- [x] A logo mark: Linkwell's chain link in ink line art before the name, in the top bar and on the privacy and terms pages (`LogoMark`)
- [x] Each empty list gets its own drawing: nothing unread, the character with a cup of tea next to a big tick (`CaughtUp`); no broken links, a thumbs-up next to a healthy chain link (`AllWell`); an empty folder, the character holding a folder open as a moth flutters out (`EmptyFolder`). Search with no results keeps the magnifying glass
- [x] A shared `ChainLink` part in `Character.tsx` (the app icon's loops), used by the doctor, the thumbs-up scene and the logo
- [x] **Every drawing redrawn as loose pen doodles** (after a page of notebook sketches): full-body, stick arms and legs, grey marker shading, a shadow under the feet, speech bubbles. Waving with "Hi!" / "Bye!", holding an empty box, a magnifying glass and "?", a telescope on a tripod for Rediscover, a doctor's coat, sitting at a café table with tea, a thumbs-up, an empty folder
- [x] The logo mark on the landing page's top bar too
- [x] The sharing preview picture (`app/opengraph-image.png`, `twitter-image.png`) redrawn: the doodle character waving "Hi!" next to the promise
- [x] A Rediscover drawing that fits a slim banner: the character from the shoulders up with a spyglass (`Spyglass`)

Then the layout:
- [x] Rediscover as a slim banner above the list: still front and centre, but lighter. One forgotten link at a time (from up to ten), with "Show another" (a round arrow button on phones)
- [x] Phones: the sidebar becomes a drawer behind a **Lists** button next to the list's heading (it slides over a dimmed page; Close, Esc, a tap outside or picking something closes it), and the details panel a full-screen sheet
- [ ] Calmer cards: title, site name (not the full address), date and tags; Mark read and Details up front, the folder menu, Edit and Delete in the details panel
- [ ] Read links fade a little; one button style instead of pills next to plain text buttons
- [ ] The sidebar shows the 5 most used tags, with "Show all"; the list's heading says how many links it has ("6 links")
- [ ] The selected list, folder, tag and view live in the address (`/?folder=…&view=list`), so the back button works and lists can be bookmarked
- [ ] The contrast and browser tests cover the new layout in light and dark mode

**You'll learn:** layouts with CSS Grid, responsive navigation, keeping state in the URL (`useSearchParams`), and keyboard-friendly focus handling.

## v2.0: Runs on its own 🌱

Linkwell should keep running, safe and up to date, even when nobody works on it for a year, and be easy to pick up again.

**Locked accounts** (the most important step: most small projects are broken into through a stolen password, not clever code)
- [ ] Two-factor sign-in on GitHub, Vercel, Neon and Google Cloud
- [ ] Protect the `main` branch on GitHub: changes go through a pull request whose tests passed

**Automatic checks**
- [ ] GitHub Actions: run `npm run check` (and the browser tests) on every pull request
- [ ] Dependabot: weekly pull requests for package updates and security fixes, which the tests check before you merge
- [ ] A health check (`/api/health`) and a free uptime monitor that emails you when the site is down
- [ ] Error tracking (for example Sentry's free plan), so errors on the live site are reported instead of lost

**Data that survives**
- [ ] Backups: know how to restore the database (Neon's restore window), plus a regular export kept somewhere else
- [ ] Keep secrets only in Vercel and `.env.local`, and write down which ones exist (never their values)

**Coming back later**
- [ ] A `MAINTENANCE.md`: where everything lives (GitHub, Vercel, Neon, Google Cloud), every secret's name and where to renew it, how to update Next.js and other packages safely, and how to run migrations

**You'll learn:** CI/CD, dependency management, monitoring, backups, and writing for your future self.

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

1. **A product page** (now planned as v1.8): what Linkwell does and why, screenshots, help/FAQ and downloads. Writing it means answering "why Linkwell and not Raindrop?" in one sentence
2. **Real users and their feedback:** find 10 to 20 people who keep using Linkwell every week, and learn what they miss
3. **A better layout** (now planned as v1.9): a sidebar with your folders, a choice of views (cards, a compact list, or big previews), and a details panel beside the list. Take the navigation ideas, but keep what's Linkwell's own (Rediscover, coming back to links) front and centre
4. **Later, not now: a paid version (Linkwell Pro).** Only once people clearly use Linkwell and want more. A free plan with the basics, and Pro for features that cost money to run (AI summaries, archive copies, more storage), with a pricing page and payments (for example Stripe). Until then, build costly features with an on/off switch and a limit, so they're ready to become Pro

**Other ideas:**

- AI summary and tag suggestions: when a link is saved, a short summary (two sentences) appears on its card, and Linkwell suggests tags and a folder you can accept or change. Could use Claude through the Anthropic API; it costs a little per link, so it may need a limit or an on/off switch. Builds on the page fetching that already reads titles
- Keyboard shortcuts
- A welcome screen (a launch screen), like the big chat and photo apps show while they open: the Linkwell logo mark in the middle of a plain page, and maybe the character waving in the doodle style, for a moment as the app starts. Two parts:
  - When Linkwell is opened from the Home Screen: phones show a launch screen built from `app/manifest.ts` (`background_color`, `name`, the icons). Some phones need their own start-up images (`apple-touch-startup-image` links, one per screen size)
  - Inside the app: a short fade-in of the logo the first time the links page loads, skipped for people who turn off animations (`prefers-reduced-motion`), and never slowing down people who open it many times a day
- Docker: only if Linkwell ever moves off Vercel and Neon to a server we run ourselves. Not needed while Vercel runs the app and Neon runs the database
- Fetch each page's description (and maybe a preview image) when it's saved
- Optional: a weekly email digest of forgotten links (needs the deployed app, accounts, a schedule and an email service)

## How to use this roadmap

- Work on **one milestone at a time**, top to bottom.
- Tick boxes (`- [x]`) as you finish items and commit the change.
- Ideas go into **Later / ideas** first. Move them into a milestone only once you decide to build them.
