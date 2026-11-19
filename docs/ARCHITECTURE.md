# Architecture

How Linkwell is put together, how data moves through it, and the rules for
adding code. It describes how things are **now**; why they got that way is in
[DECISIONS.md](DECISIONS.md). Update both when something changes.

## 1. The system

```
                   ┌──────────────────────── Vercel ────────────────────────┐
  Browser ───────► │ proxy.ts ──► Next.js 16 (App Router)                   │
  (the app,        │  nonce + CSP   pages · Server Actions · Route Handlers │──► Neon Postgres
  bookmarklet,     │                         │                              │    (prod · dev · test)
  extension,       │                         └──► other websites            │
  phone share)     │                              (titles, link checks,     │
                   │                               only through safeFetch)  │
                   └────────▲──────────────────────────▲────────────────────┘
                            │                          │
             Google sign-in (Better Auth)     Vercel Cron, daily ──► /api/cron/check-links
                                              UptimeRobot, 5 min ──► /api/health

  GitHub: every pull request runs the Checks (types, lint, unit + browser tests);
  main is protected; merging deploys to Vercel. Dependabot opens updates weekly.
```

| Part | Where | Job |
|---|---|---|
| Web app | Vercel, Next.js 16 | Pages, Server Actions and API routes |
| Database | Neon Postgres, via Drizzle | Users, links, folders, rate limits. Three branches: production, dev, test |
| Sign-in | Better Auth + Google | Sessions in Postgres, signed with `BETTER_AUTH_SECRET` |
| Daily job | Vercel Cron (`vercel.json`) | Checks every link, clears old rate-limit counts, empties what's been in the Trash for 30 days |
| Monitoring | UptimeRobot → `/api/health` | Emails when the app or database is down |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | The same `npm run check` and `npm run e2e` as on your computer |

## 2. Folder layout

`app/` is only for routes; everything else lives in shared top-level folders.

| Folder | Holds |
|---|---|
| `app/` | Pages, layouts, `actions.ts` (Server Actions), `api/` (auth, cron, export, health, `links`: pages of links and the summary), metadata files (`manifest.ts`, icons, sharing pictures) |
| `components/` | React components. `illustrations/` holds the drawings: the character's parts in `Character.tsx`, one scene per file |
| `lib/` | Plain TypeScript, no React: rules and helpers (`links.ts`), what a list is and how it's paged (`linkQuery.ts`), asking `/api/links` (`linkSource.ts`), reading the address (`address.ts`), the folder tree (`folders.ts`), the database (`data.ts`), fetching other sites (`safeUrl.ts`, `fetchTitle.ts`, `checkLink.ts`), security (`csp.ts`, `limits.ts`), sign-in (`auth.ts`, `session.ts`) |
| `db/` | Connection and table definitions (`schema.ts`, `auth-schema.ts`). Server-only |
| `drizzle/` | Generated SQL migrations. Committed, never edited |
| `types/` | Shared types (`Link`, `Folder`) |
| `__tests__/`, `e2e/` | Unit tests (Vitest) and browser tests (Playwright) |
| `scripts/` | `npm run backup` / `restore` |
| `extension/` | The browser extension: plain JavaScript that only opens `/share` |
| `public/` | Static files: app icons, landing-page screenshots (imported by `Landing.tsx`, so each version gets its own address), the demo's pictures |

Root files: `proxy.ts` (runs before every page), `next.config.ts` (security
headers), `drizzle.config.ts`, `vercel.json` (cron), `.env.local` (secrets,
never committed; see [MAINTENANCE.md](../MAINTENANCE.md#secrets)).

## 3. Layers

Each layer only uses the layers **below** it:

```
 app/            pages (Server Components) and Server Actions
   ▼
 components/     the interactive UI (Client Components)
   ▼
 lib/            links.ts and friends: pure, used on both sides
                 data.ts, auth.ts, safeUrl.ts: server-only
   ▼
 db/  types/     tables and shapes
```

- A client component never imports `lib/data.ts` or `db/`: both start with
  `import "server-only"`, so the build fails if one does.
- `lib/` never imports from `components/` or `app/`; `types/` imports nothing.
- Components don't import Server Actions directly: they call
  `useLinkActions()` (`components/LinkActions.tsx`). The real app gets the real
  actions; the demo (`/demo`) provides stand-ins (`lib/demo.ts`) that never
  reach the server.

## 4. How a request flows

### Opening the links page

1. `proxy.ts` makes a fresh **nonce** and sends the Content-Security-Policy
   (`lib/csp.ts`). Only scripts carrying that nonce can run.
2. `app/page.tsx` (a Server Component) reads the session. Signed out, it shows
   `Landing`. Signed in, it loads the folders, the Trash and the **summary**
   together (`getLinkSummary`: counts, tags, each folder's newest pictures,
   and Home's Unread, Recently saved and Rediscover links, in one batch),
   plus the **first page** (50 links) of the list in the address, if one is
   shown. Not every link: since v2.5 an account can hold 10,000.
3. `LinkManager` (client) keeps what it got in state: `links` (every link the
   page has seen so far), `folders`, the `trash` and the summary. More links
   come a page at a time from `GET /api/links` (below).

```
 app/page.tsx ──► getFolders · getTrash · getLinkSummary · getLinkPage(first 50)
                       │
                       ▼
 LinkManager ── useLinkList ── scroll near the end ──► GET /api/links?…&after=<cursor>
      │                   └── search, sort, another list ──► GET /api/links?…
      └── after a change ──► GET /api/links/summary (new counts), ?count=1 (the list's length)
```

### Saving a link

```
 LinkForm ──onAdd(url, title, tags, folderId)──► LinkManager.addLink
                                                    │ duplicate? → message back to the form
                                                    ▼
                                    saveLink(link)   (Server Action, app/actions.ts)
                                      1. getUserId()         who is asking
                                      2. isTooFast()         rate limit (lib/limits.ts)
                                      3. cleanNewLink()      never trust the browser
                                      4. duplicate? limit?   against the database
                                      5. own folder?         else saved with no folder
                                      6. fetchPageInfo()     title + picture if none typed, via safeFetch
                                         (typed title: picture looked for after answering)
                                      7. insertLink()        lib/data.ts
                                                    │
                     the saved Link (or an error message string) ◄──┘
```

The card only appears with what the server saved, so screen and database
agree. Smaller changes (read, move, delete, edit) update the screen first and
then call their action: they feel instant and rarely fail. After an `await`,
state is always updated with the updater form (`setLinks((current) => …)`).
A link that's in the Trash isn't saved again: the form offers **Restore it**.

### Deleting, Undo and the Trash

```
 Delete ──► LinkManager.deleteLinks ── moves the links into `trash` state
              │                       └─ showToast("Link moved to the Trash", undo)
              ▼
     removeLink / removeLinks   (Server Action)  ──► trashLinks: deleted_at = now
                                                       (the row stays)
 Undo / Restore ──► restoreLinks ──► deleted_at = null; a folder that's gone → no folder
 Daily job ──► deleteOldTrash: rows with deleted_at older than 30 days are deleted
```

- **Soft deletes**: `deleted_at` instead of `DELETE`. `ownLink` / `ownFolder`
  and `getLinks` / `getFolders` skip deleted rows, so every list, count,
  search, the export and the daily check leave the Trash out without their own
  changes. Only the Trash's functions in `lib/data.ts` see deleted rows.
- **Deleting a folder** never deletes links: its links and the folders inside
  it move up one level in one batch (a transaction) and remember it in
  `came_from_folder_id`. Restoring it moves back only what's still where the
  delete left it, so something moved by hand since stays put. Moving by hand
  clears `came_from_folder_id`.
- **Undo** (`components/UndoToast.tsx`): one message at a time, 6 seconds,
  paused on hover or focus, `role="status"`. It puts back each link's own
  earlier value (old folder, old read date via `setReadDates`), not a guess.

### Folders inside folders

`folders.parent_id` points at another folder (`null` = top level). The browser
gets the flat list and builds the tree itself with the helpers in
`lib/folders.ts` (`childFolders`, `folderPath`, `folderAndInside`,
`flattenTree`, `countWithInside`); the server and the demo use the same ones.
Names are unique among neighbours only. The "not inside itself" check asks
the database: `getFolderAncestors` follows `parent_id` up with `WITH
RECURSIVE`. The sidebar's open folders are remembered per device
(`useOpenFolders`).

### Your own order and dragging

`folders.position` is a folder's place among its neighbours (0, 1, 2…). One
helper, `placeFolder` in `lib/folders.ts`, puts a folder at a place and
numbers that level again; the browser uses it to show a move at once,
`moveFolder` uses it to work out the order it saves (`updateFolderPlace`, one
batch), and Undo uses it to put the folder back. New and restored folders go
last (the database works out the number in the same query).

Dragging lives in `components/DragAndDrop.tsx`: a `DragProvider` in
`LinkManager`, and `useDrag()` in what can be picked up (`LinkCard`, the
`FolderBar` rows, folder tiles) or dropped on (anything with
`data-drop-folder`). It uses pointer events, so a mouse, a finger and a pen
share one code path: a mouse picks up after a small move, a finger after a
press and hold. While dragging, the drop spot is found with
`document.elementFromPoint`, the ghost moves without React drawing the page
again, and an `aria-live` line says what's happening. `LinkManager` decides
what may land where (`canDrop`) and does the move (`drop`), through the same
functions as Move to…, so every drop gets the Undo message. Without dragging:
Move to…, Move up / Move down in the Edit folder panel, and Alt+arrows on a
folder in the sidebar. The sidebar can show My order or A to Z
(`useFolderOrder`, per device).

### What the list shows

`LinkManager` stores only facts: `links`, `folders`, the `trash`, the summary,
the search text, the sort order, the open details panel, the Undo message and
whether the phone's Folders screen is open. Everything else is **derived**.

**What a list is** lives in `lib/linkQuery.ts`, once. The address and the
toolbar become a `LinkQuery` (`shownQuery`: list, folders, tag, search,
sort; `null` on Home, Folders and the Trash), and the rules say which links
it finds (`matchesQuery`) and in what order (`compareLinks`, ties by id).

**Two modes**, behind one hook (`components/useLinkList.ts`):

| | Signed in (server mode) | The demo and unit tests (local mode) |
|---|---|---|
| The page gets | A summary and the first page | Every link |
| Counts, tags, Home | The summary, from the database (`getLinkSummary`) | `summarize(links)` on each render |
| A list | Pages of 50 from `/api/links` (the SQL in `lib/data.ts` follows the rules) | `queryLinks(links, query)`, drawn 50 at a time |
| Search | In the database, 250 ms after typing stops; an older question is cancelled | At once, in memory |
| Select all | Asks the server for every link of the list | Every link of the list |

In server mode a change still shows at once: the page changes its own copy
of the link, the list checks its links against the query again on every
render (a link marked read leaves Unread), and `liveSummary` does the same
for Home. Then `changed()` asks for the new counts, 300 ms after the last
change; if links may have joined the list on screen (moved into the open
folder, say), the list is loaded again from the top. Questions to the server
wait for the changes still being saved (`afterSaving`), so an answer never
misses one. Links from the server are only added, never written over
(`addNewLinks`): the page's own copy may hold a change still on its way. Links
deleted on the page are never added back by a late answer, and each visit to
a list asks for it again (`useLinkList`), so nothing from a visit before
shows up stale.

**Pages** use keyset pagination: each page ends with a cursor, the last
link's sort key (its date exactly as the database wrote it, to the
microsecond, or its title key) and id; the next page is "after that". The
index `links_user_created_idx` makes that a jump, however deep in the list.
The end of the list has a **Show more links** button that an
`IntersectionObserver` presses on its own when it scrolls near.

The chosen **list, folder, tag and view live in the address**
(`/?folder=…&tag=react&view=list`, `lib/address.ts` and
`components/useAddressState.ts`), so Back, refresh and bookmarks keep your
place. `/` is **Home** (`HomeView`); the lists are `?list=all`, `unread`,
`broken`, `unsorted` (not in a folder) and `trash`. Per-device choices (the
view, the share page's last folder) live in `localStorage`. The search box
keeps what's typed itself (`SearchBox`), so a key press only redraws the box.

**Server and browser must render the same first time (hydration).** The server
picks `now` once and passes it down; anything only the browser knows (storage,
clipboard, the address) is read with `useSyncExternalStore`, whose server
snapshot matches what the server rendered.

### Other paths

| Path | Flow |
|---|---|
| Save from anywhere | Bookmarklet, extension and phone share all open `/share?url=…`. Nothing is saved until the user clicks **Save link** (any site could open that address) |
| Daily check | Vercel Cron → `/api/cron/check-links` (needs `CRON_SECRET`) → `checkLink` per link via `safeFetch` → `updateLinkStatus`; then preview pictures for up to 50 older links (`fetchPageInfo` → `updateLinkImage`); then the Trash's 30-day clean-up (`deleteOldTrash`) |
| Pages of links | `GET /api/links?list=…&folder=…&tag=…&q=…&sort=…&after=…` → 50 links, how many the list has, and the next cursor. `&all=1`: every link of the list (Select all); `&count=1`: just how many. The question is read with `queryFromParams`, which keeps only what it understands. Never cached |
| Summary | `GET /api/links/summary` → counts, tags, pictures and Home's links (`LinkSummary`) |
| Export | `/api/export` → the user's links as a bookmarks file, nested folders as nested lists (the Trash is left out) |
| Health | `/api/health` → `select 1` → 200 `ok` or 503 `down`, never cached |

## 5. Server and client components

Components are Server Components unless they start with `"use client"`, which
they need for state, effects, event handlers or browser APIs. Keep it as low as
possible: pages load data on the server and hand it to one client component.

| Area | Main files |
|---|---|
| Pages | `app/page.tsx` (landing or the app), `account/`, `share/`, `demo/`, `privacy/`, `terms/` |
| The app | `LinkManager` (state and layout) → `Header` + `LinkForm` (top bar), `Sidebar` + `FolderBar` (lists, the folder tree, tags, Trash; wide screens only; phones use the Folders screen and Home's More part), `HomeView` (the first screen), `TrashView`, `UndoToast`, `BottomBar` (phones, on every signed-in page: Home, Folders, +, Unread, You; tap, or press and slide along it), `Rediscover` (banner on Home), `LinkCard` (card or list row; Select mode ticks), `LinkDetails` (panel; a bottom sheet below `lg`), `FolderActions` (the pencil next to a folder's name and its Edit folder panel: name, colour, icon, Pin to Home, New folder inside, Move folder to, Move up / Move down, Delete), `DragAndDrop` (picking links and folders up, with a mouse, a finger or the keyboard), `AddLinksSheet` (fill a folder like a playlist), `FolderPicker` |
| Shared pieces | `LinkParts` (`Favicon`, `PreviewImage`, `Badges`, `StickyNote`, `EditForm`), `Sheet` (bottom sheet on phones, dialog on wider screens), `LogoMark`, `FolderIcon`, `ListIcon` |
| Hooks | `useLinkList` (the list on screen, a page at a time, in either mode), `useAddressState` (state in the address), `useLinkView` (Cards or List per device), `useOpenFolders` (open folders in the tree, per device), `useFolderOrder` (My order or A to Z, per device), `useDrag` (what's picked up, and where it would land), `useLinkActions` (server or demo actions), `useSwipeToClose` (a sheet's handle) |
| Around it | `Landing`, `ShareForm`, `ImportBookmarks`, `Bookmarklet`, `UsernameForm`, `DeleteAccount`, `LegalPage`, `Footer` |

Props from server to client must be serializable (plain data and `Date`s; no
functions except Server Actions). **Server Actions are public**: anyone can
call them with anything, which is why every one checks its input again
(section 7).

## 6. Data

All database access goes through **`lib/data.ts`**. Every function takes the
signed-in user's id, and every read, update and delete matches it
(`ownLink`, `ownFolder`), so a guessed id from another account changes nothing.

| Table | Holds | Notes |
|---|---|---|
| `links` | url, title, tags (`text[]`), note, `created_at`, `status` + `checked_at` (link check), `read_at`, `folder_id`, `came_from_folder_id`, `image`, `deleted_at`, `user_id` | `folder_id` → `folders`, `ON DELETE SET NULL`. `image`: the page's sharing picture (https), `""` when it has none, `null` when not looked for yet. `deleted_at`: in the Trash since then. `came_from_folder_id`: the deleted folder it moved out of |
| `folders` | name, colour, icon, `parent_id`, `came_from_folder_id`, `pinned_at`, `position`, `deleted_at`, `user_id` | `parent_id` → `folders` (its own table), `null` = top level. Names unique among folders with the same parent, ignoring case (checked by the actions). `pinned_at`: shown first on Home. `position`: your own order among neighbours, from 0 |
| `rate_limits` | `user_id`, action, window start, count | One row per window; `INSERT … ON CONFLICT DO UPDATE` counts atomically |
| `user`, `session`, `account`, `verification` | Better Auth's tables (`db/auth-schema.ts`) | Deleting a user deletes everything of theirs (`ON DELETE CASCADE`) |

In the app, dates are ISO strings and missing values are `undefined`; in the
database they're timestamps and `null`. `toLink` / `toFolder` convert.

**Indexes** (migration `0018`): `links (user_id, created_at, id)` and
`links (user_id, folder_id)`, both only for rows not in the Trash
(`WHERE deleted_at IS NULL`); `links (user_id, deleted_at)` for the Trash;
`folders (user_id)`. Check what the database does with a question with
`EXPLAIN ANALYZE` (`npm run measure` prints the plans of the main ones).

**Three databases** (Neon branches): `DATABASE_URL` (dev, your computer),
`E2E_DATABASE_URL` (browser tests and CI), `PROD_DATABASE_URL` (production,
used locally only for migrations and backups). **Migrations** run on production
**before** the code that needs them is merged. The steps, backups and restoring
are in [MAINTENANCE.md](../MAINTENANCE.md).

## 7. Security

| Threat | Protection | Where |
|---|---|---|
| Someone calls an action with made-up input | Every action checks the session and cleans its input again: lengths, `http(s)` only, tag rules, folder ownership | `app/actions.ts`, `cleanNewLink` and friends in `lib/links.ts` |
| Changing another user's data | Every query matches the user's id | `lib/data.ts` |
| SSRF: making the server fetch private addresses | `safeFetch` resolves the host and refuses private, loopback and cloud-metadata addresses, **again on every redirect** | `lib/safeUrl.ts` |
| Injected scripts | Per-request nonce CSP with `strict-dynamic`; text is rendered by React, never as raw HTML. Images may come from any https site (preview pictures), nothing else from outside | `proxy.ts`, `lib/csp.ts` |
| Clickjacking, sniffing, downgrade | `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, HSTS | `next.config.ts` |
| Abuse of expensive work | Rate limits in Postgres (works across many server instances) | `lib/limits.ts` |
| Saving through someone else's browser | `/share` only saves after a click | `components/ShareForm.tsx` |
| The cron route | Refused without `CRON_SECRET` | `app/api/cron/check-links/route.ts` |
| Leaked backups | Backups hold no tokens, sessions or passwords, and are owner-readable only | `scripts/backup-lib.mjs` |

**Checklist for every new feature:**

- [ ] Actions and routes start with `getUserId()` / a session check and pass the id to `lib/data.ts`
- [ ] Input is checked again on the server; new limits go in `lib/links.ts` or `lib/limits.ts`, and forms use the same `maxLength`
- [ ] Expensive work gets a rate limit, counted before the work starts
- [ ] Other websites are fetched only through `safeFetch`
- [ ] User text is shown with React (`{text}`), never `dangerouslySetInnerHTML`
- [ ] Anything loaded from another site is added to `lib/csp.ts` on purpose (the security-header browser test fails until it is)
- [ ] New tables have `user_id … ON DELETE CASCADE`
- [ ] Storing something new about people, or sending data somewhere new, updates `/privacy`
- [ ] Secrets only in `.env.local` and Vercel

How to report a problem: [SECURITY.md](../SECURITY.md).

## 8. Testing

| Kind | Tool | Covers |
|---|---|---|
| Unit | Vitest + Testing Library (jsdom) | `lib/` rules, Server Actions (with `lib/data` mocked), components acting like a user, the demo never calling the server |
| Browser | Playwright (`e2e/`), against the test database | Sign-in, saving, folders inside folders, Trash and Undo, Home and the phone's tab bar, Back and refresh, the share page, the demo, dragging, paging and server search checked against `lib/linkQuery.ts` (`pages.spec.ts`), security headers (no blocked resources), health |
| Speed | `npm run measure` (`e2e/scale.spec.ts`), only when asked | Fills a test account with 10,000 links, times Home, All links, search and a folder on a computer and a slowed-down phone, and prints `EXPLAIN ANALYZE` plans. The numbers are in the roadmap (v2.5) |
| Accessibility | Playwright, `e2e/contrast.ts` | Every text on every page and state meets WCAG AA contrast, in light and dark mode |

Rules:

- Find elements like a user would: by role, label or placeholder, never by CSS
  class. If a test can't find it, a screen reader probably can't either.
- Never touch a real database in unit tests: mock `@/app/actions` or `@/lib/data`.
- Code that fetches takes the fetch function as a parameter, so tests pass a fake.
- Time-dependent code takes `now` as a parameter (with a default).
- Browser tests sign in without Google (`e2e/fixtures.ts`): each test gets its
  own new user, deleted afterwards, so tests run in parallel.
- Every feature comes with tests; every bug fix gets a test that would have
  caught it. `npm run check` and `npm run e2e` pass before every merge (CI
  enforces it).

## 9. Conventions

- **Files:** components `PascalCase.tsx`, one per file, default export; everything else `camelCase.ts`. Imports use the `@/` alias and `import type` for types.
- **Styling:** Tailwind classes in the JSX. Shared looks are `@utility` classes in `app/globals.css`: `glass`, `glass-bar`, `field`, `field-area`, `btn-primary`, `btn-secondary`, `btn-quiet`, `btn-danger`, `sidebar-item`. Add layout classes next to them, don't override them.
- **Colours are tokens named by their job** (`text-ink`, `text-muted`, `bg-canvas`, `bg-surface`, `border-line`, `text-accent`, `text-danger`, `text-highlight`, folder colours, the drawings' `marker` greys), defined once in `app/globals.css` for light and dark mode. Never a fixed shade like `text-slate-900`, or dark mode breaks.
- **Drawings** are SVG components in black, white and marker grey, built from the character's parts in `components/illustrations/Character.tsx`, and always `aria-hidden`.
- **State:** keep it in the lowest component that needs it; never change it in place; compute what can be computed.
- **Optional fields:** new `Link` fields are optional, so old data still shows.
- **URLs:** parse with `new URL()` inside `try/catch`; old data may not be valid.
- **Database code** starts with `import "server-only"`, and every `update` / `delete` has a `.where(...)`. Reads and updates skip the Trash (`deleted_at is null`) unless they're the Trash's own.
- **User-facing text** names no other companies or products ("your browser", "other bookmark apps").
- **Next.js 16 differs from older versions** (`proxy.ts`, `PageProps`, `connection()`): read the docs in `node_modules/next/dist/docs/` before using an API (see `AGENTS.md`).
