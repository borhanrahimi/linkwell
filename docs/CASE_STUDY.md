# Linkwell: a case study

**Linkwell** is a bookmark manager built around three promises: *save links,
keep them alive, actually come back to them.*
[Live site](https://linkwell-dypu.vercel.app) ·
[Try the demo](https://linkwell-dypu.vercel.app/demo) ·
[Code](https://github.com/borhanrahimi/linkwell)

## The problem

Bookmarks are where links go to die. You save a page, never open it again,
and by the time you look for it, the page is gone. Most bookmark tools are
good at the first step (saving) and ignore the other two: noticing when a link
breaks, and bringing back the ones you forgot.

## What I built

- **Save from anywhere**: a save box in the top bar, a bookmarklet, a browser
  extension, the phone's share menu (Linkwell installs as an app), copy and
  paste, and importing a browser's bookmarks file. A link can go straight into
  a folder, with tags and a note on why it was saved.
- **Keep them alive**: a daily job checks every saved link. A broken one gets a
  red badge and a link to an archived copy of the page.
- **Come back to them**: a Home screen with a greeting, what's unread, what
  was saved lately and your folders; Rediscover brings back links saved weeks
  ago and never read, one at a time.
- **Organise**: folders with colours and hand-drawn icons, folders inside
  folders (as deep as you like), tags, search, sort, Cards or List view, a
  details panel, Select mode, and smart lists (Unread, Broken, Not in a folder).
- **Nothing lost by one wrong tap**: a Trash that keeps deleted links and
  folders for 30 days, and Undo after every delete, move or read change.
- **Around it**: Google sign-in, an account page (export, delete), a landing
  page, privacy and terms pages, and a demo that needs no account.

Built with Next.js 16 (App Router, Server Actions), React 19, Tailwind CSS 4,
Postgres on Neon with Drizzle, Better Auth, Vitest and Playwright, deployed on
Vercel. It grew in small milestones (see the [roadmap](ROADMAP.md)), each one
shipped on its own.

## Key decisions

The full list, with the reasoning, is the
[decision log](DECISIONS.md). The ones that shaped it most:

| Decision | Why |
|---|---|
| **Never trust the browser**: every Server Action cleans its input again and scopes every query to the signed-in user | The browser can send anything. Updates match on the link's id **and** the user's id, so a guessed id from another account changes nothing |
| **The server refuses to fetch private addresses**, checked again after every redirect | Linkwell fetches the pages people save (titles, daily checks). Without this, a link to `http://169.254.169.254/` could make the server read its own cloud secrets (SSRF) |
| **A Content-Security-Policy with a fresh nonce per request** | Only Linkwell's own scripts can run, even if something slips into a page |
| **Rate limits in Postgres**, not in memory | Vercel runs many short-lived server instances; a counter in memory would reset all the time |
| **State in the address** (`/?folder=…&tag=react&view=list`) | Back, refresh and bookmarks keep your place; it works without a router in tests |
| **Test what users experience**: accessibility contrast measured in a real browser, in light and dark mode | Colours drift as a design grows; a test catches it. It caught a real one: a "Broken" badge too faint to read in light mode |
| **The demo swaps the server for stand-ins** through a React context | The real components run unchanged; the demo's actions never reach the server, and a test proves it |
| **Backups leave out sign-in tokens and sessions** | They're secrets that expire anyway. A leaked backup then holds no keys to anyone's account |
| **Soft deletes**: a `deleted_at` column instead of deleting the row, and a daily clean-up after 30 days | Every delete can be undone. The data layer hides the Trash in one place, so lists, counts, search, the export and the daily check didn't need their own changes |
| **Undo puts back exact earlier values**, per link | Select mode changes many links that each had their own folder and read date; an Undo that guesses would be wrong |
| **Folders form a tree from one flat list**, and the database refuses loops (`WITH RECURSIVE`) | The page already loads every folder, so the browser builds the tree itself; the server asks the database whether a move would put a folder inside itself |

## What was hard

- **Fetching other people's pages safely.** Redirects can lead from a public
  address to a private one, so each hop is checked again. Big sites also send
  servers in data centres a cut-down page (titled just " - YouTube" in
  production, while it worked locally); the fix was asking the sites' own
  title services (oEmbed) first.
- **A strict Content-Security-Policy with Next.js.** Nonces need pages to render
  per request, and development mode needs different rules than production.
  A browser test now records any blocked resource on every page.
- **Server and browser agreeing on the first render.** Things only the browser
  knows (the saved view, the clipboard, the address) go through
  `useSyncExternalStore`, so the first render matches the server's.
- **Undoing a folder delete.** Deleting a folder moves its links and
  subfolders up a level; restoring it has to move them back, but not the ones
  you've moved somewhere else since. Each moved thing remembers the folder it
  came from (`came_from_folder_id`), and moving it by hand clears that.
- **Keeping it running without me.** CI caught the first two big package
  upgrades (TypeScript 7, ESLint 10) failing *before* they reached the live
  site; it turned out the tools Next.js's lint setup is built on don't support
  them yet.

## How I used AI

I built Linkwell with an AI coding assistant (Claude). I set the direction:
the product, the roadmap, what each step should do, the look (the character is
drawn after my own photo), and what to accept or change. The assistant wrote
much of the code, ran the tests, and explained its choices; I reviewed the
results, asked why, and pushed back. The decision log and the "You'll learn"
line on each roadmap milestone are the trail of what I learned along the way.

## What I learned

- Full-stack Next.js: Server Components and Actions, Route Handlers, the proxy,
  metadata, and rendering per request.
- Data: Postgres schemas, migrations and their order (database before code),
  soft deletes, a table that points at itself (a tree) and recursive queries,
  and backups that are restored, not just taken.
- Security: input validation, SSRF, CSP, rate limiting, least privilege for
  secrets.
- Testing: unit tests with mocks, browser tests against a separate database,
  and testing accessibility instead of assuming it.
- Running software: CI, protected branches, dependency updates, health checks
  and monitoring, and writing [maintenance notes](../MAINTENANCE.md) for
  future me.

## Interview study guide

Questions I should be able to answer, and where the answer lives:

| Question | Where to look |
|---|---|
| How does a saved link get its title? What if the site blocks you? | `lib/fetchTitle.ts` |
| How do you stop the server fetching private addresses? Why re-check redirects? | `lib/safeUrl.ts` |
| What does the Content-Security-Policy allow, and how does the nonce get to the page? | `lib/csp.ts`, `proxy.ts` |
| How do rate limits work across many server instances? | `lib/limits.ts`, `countAction` in `lib/data.ts` |
| How can't one user change another user's links? | `lib/data.ts` (every query matches the user's id) |
| How does the list remember its folder and tag in the address? | `components/useAddressState.ts` |
| How does the demo avoid the server? | `components/LinkActions.tsx`, `lib/demo.ts` |
| What runs on every pull request, and what's protected? | `.github/workflows/ci.yml`, `MAINTENANCE.md` |
| How would you restore the database? | `MAINTENANCE.md` → Backups, `scripts/backup-lib.mjs` |
| How do you know the colours are readable? | `e2e/contrast.ts`, `e2e/contrast.spec.ts` |
| How does the Trash work, and why not just `DELETE`? | `lib/data.ts` (`trashLinks`, `restoreLinks`, `deleteOldTrash`), `docs/DECISIONS.md` |
| How does Undo know what to put back? | `components/LinkManager.tsx` (`moveMany`, `markManyRead`), `components/UndoToast.tsx` |
| How do you store a tree in a table, and stop a folder going inside itself? | `db/schema.ts` (`parent_id`), `lib/folders.ts`, `getFolderAncestors` in `lib/data.ts` |
