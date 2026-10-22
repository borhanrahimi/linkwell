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
| Daily job | Vercel Cron (`vercel.json`) | Checks every link, clears old rate-limit counts |
| Monitoring | UptimeRobot → `/api/health` | Emails when the app or database is down |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | The same `npm run check` and `npm run e2e` as on your computer |

## 2. Folder layout

`app/` is only for routes; everything else lives in shared top-level folders.

| Folder | Holds |
|---|---|
| `app/` | Pages, layouts, `actions.ts` (Server Actions), `api/` (auth, cron, export, health), metadata files (`manifest.ts`, icons, sharing pictures) |
| `components/` | React components. `illustrations/` holds the drawings: the character's parts in `Character.tsx`, one scene per file |
| `lib/` | Plain TypeScript, no React: rules and helpers (`links.ts`), the database (`data.ts`), fetching other sites (`safeUrl.ts`, `fetchTitle.ts`, `checkLink.ts`), security (`csp.ts`, `limits.ts`), sign-in (`auth.ts`, `session.ts`) |
| `db/` | Connection and table definitions (`schema.ts`, `auth-schema.ts`). Server-only |
| `drizzle/` | Generated SQL migrations. Committed, never edited |
| `types/` | Shared types (`Link`, `Folder`) |
| `__tests__/`, `e2e/` | Unit tests (Vitest) and browser tests (Playwright) |
| `scripts/` | `npm run backup` / `restore` |
| `extension/` | The browser extension: plain JavaScript that only opens `/share` |
| `public/` | Static files: app icons, landing-page screenshots |

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
   `Landing`. Signed in, it loads links and folders together
   (`Promise.all([getLinks(), getFolders()])`) and renders `LinkManager` with
   them, the server's time (`now`) and the address's query (`initialSearch`).
3. `LinkManager` (client) keeps the links and folders in state from then on.

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
                                      6. fetchTitle()        if none typed, via safeFetch
                                      7. insertLink()        lib/data.ts
                                                    │
                     the saved Link (or an error message string) ◄──┘
```

The card only appears with what the server saved, so screen and database
agree. Smaller changes (read, move, delete, edit) update the screen first and
then call their action: they feel instant and rarely fail. After an `await`,
state is always updated with the updater form (`setLinks((current) => …)`).

### What the list shows

`LinkManager` stores only facts: `links`, `folders`, the search text, the sort
order, the open details panel and whether the phone drawer is open. Everything
else is **derived** on each render and never stored:

```
visibleLinks = sort(search(filterByTag(filterByFolder(filterByList(links)))))
```

The chosen **list, folder, tag and view live in the address**
(`/?folder=…&tag=react&view=list`, `components/useAddressState.ts`), so Back,
refresh and bookmarks keep your place. Per-device choices (the view, the share
page's last folder) live in `localStorage`.

**Server and browser must render the same first time (hydration).** The server
picks `now` once and passes it down; anything only the browser knows (storage,
clipboard, the address) is read with `useSyncExternalStore`, whose server
snapshot matches what the server rendered.

### Other paths

| Path | Flow |
|---|---|
| Save from anywhere | Bookmarklet, extension and phone share all open `/share?url=…`. Nothing is saved until the user clicks **Save link** (any site could open that address) |
| Daily check | Vercel Cron → `/api/cron/check-links` (needs `CRON_SECRET`) → `checkLink` per link via `safeFetch` → `updateLinkStatus` |
| Export | `/api/export` → the user's links as a bookmarks file |
| Health | `/api/health` → `select 1` → 200 `ok` or 503 `down`, never cached |

## 5. Server and client components

Components are Server Components unless they start with `"use client"`, which
they need for state, effects, event handlers or browser APIs. Keep it as low as
possible: pages load data on the server and hand it to one client component.

| Area | Main files |
|---|---|
| Pages | `app/page.tsx` (landing or the app), `account/`, `share/`, `demo/`, `privacy/`, `terms/` |
| The app | `LinkManager` (state and layout) → `Header` + `LinkForm` (top bar), `Sidebar` + `FolderBar` (lists, folders, tags; a drawer on phones), `Rediscover` (banner), `LinkCard` (card or list row), `LinkDetails` (panel), `FolderActions`, `FolderPicker` |
| Shared pieces | `LinkParts` (`Favicon`, `Badges`, `StickyNote`, `EditForm`), `LogoMark`, `FolderIcon` |
| Hooks | `useAddressState` (state in the address), `useLinkView` (Cards or List per device), `useLinkActions` (server or demo actions) |
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
| `links` | url, title, tags (`text[]`), note, `created_at`, `status` + `checked_at` (link check), `read_at`, `folder_id`, `user_id` | `folder_id` → `folders`, `ON DELETE SET NULL` |
| `folders` | name, colour, icon, `user_id` | Names unique per user, ignoring case (checked by the actions) |
| `rate_limits` | `user_id`, action, window start, count | One row per window; `INSERT … ON CONFLICT DO UPDATE` counts atomically |
| `user`, `session`, `account`, `verification` | Better Auth's tables (`db/auth-schema.ts`) | Deleting a user deletes everything of theirs (`ON DELETE CASCADE`) |

In the app, dates are ISO strings and missing values are `undefined`; in the
database they're timestamps and `null`. `toLink` / `toFolder` convert.

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
| Injected scripts | Per-request nonce CSP with `strict-dynamic`; text is rendered by React, never as raw HTML | `proxy.ts`, `lib/csp.ts` |
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
| Browser | Playwright (`e2e/`), against the test database | Sign-in, saving, folders, the phone drawer, Back and refresh, the share page, the demo, security headers (no blocked resources), health |
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
- **Database code** starts with `import "server-only"`, and every `update` / `delete` has a `.where(...)`.
- **User-facing text** names no other companies or products ("your browser", "other bookmark apps").
- **Next.js 16 differs from older versions** (`proxy.ts`, `PageProps`, `connection()`): read the docs in `node_modules/next/dist/docs/` before using an API (see `AGENTS.md`).
