# Architecture

This document explains how Linkwell's code is organized, how data moves through it, and the rules for adding new code. Update it whenever one of those changes.

## 1. Folder layout

Linkwell follows the "store project files outside of `app`" layout from the Next.js docs. `app/` is only for routing (and the Server Actions its pages use). Everything else lives in shared top-level folders.

| Folder | Holds | Rule of thumb |
|---|---|---|
| `app/` | Pages, layouts, Server Actions (`actions.ts`) | If it isn't tied to a URL or called from the browser as an action, it doesn't belong here |
| `components/` | React components | Only UI. Gets data through props, reports user actions through callback props or Server Actions |
| `lib/` | Plain TypeScript functions | No JSX and no React. `links.ts` is pure and easy to test; `data.ts` is the only file that queries the database; `checkLink.ts` is the only file that fetches other websites |
| `db/` | Database connection (`index.ts`) and table definitions (`schema.ts`) | Server-only. Never imported by a client component |
| `drizzle/` | Generated SQL migrations | Created by `drizzle-kit generate`. Committed, never edited by hand |
| `types/` | Shared type definitions | Only types, no runtime code |
| `__tests__/` | Automated tests | One test file per module (`links.test.ts`, `actions.test.ts`, `page.test.tsx`) |
| `docs/` | Project documentation | |

Root config files: `drizzle.config.ts` (tells `drizzle-kit` where the schema and migrations are) and `.env.local` (your `DATABASE_URL`, never committed).

## 2. Layers

The code is split into layers. Each layer may only use the layers **below** it:

```
 ┌──────────────────────────────────────────┐
 │  app/page.tsx      (Server Component)    │  loads links, renders the page
 │  app/actions.ts    (Server Actions)      │  the browser's doorway to the server
 ├──────────────────────────────────────────┤
 │  components/       (Client Components)   │  state, filters, forms, cards
 ├──────────────────────────────────────────┤
 │  lib/data.ts       (server-only)         │  reads and writes the database
 │  lib/links.ts      (pure functions)      │  creates, validates, filters, formats
 ├──────────────────────────────────────────┤
 │  db/               (server-only)         │  connection + table schema
 ├──────────────────────────────────────────┤
 │  types/            (shapes)              │  describes what a Link is
 └──────────────────────────────────────────┘
```

- ✅ `app/page.tsx` imports from `components/`, `lib/`, `types/`
- ✅ `components/LinkManager.tsx` imports from `components/`, `lib/links.ts`, `types/`, and the Server Actions in `app/actions.ts`
- ❌ A client component must never import `lib/data.ts` or `db/`. Both start with `import "server-only"`, so the build fails if one does
- ❌ `lib/` must never import from `components/` or `app/`
- ❌ `types/` imports nothing

Why: when dependencies only point downward, you can change the UI without touching the logic, and change where data is stored (memory → localStorage → Postgres) without touching the UI.

## 3. Data flow

**Data flows down, events flow up, and the server saves.**

```
  Postgres (Neon)
     │   ▲
     │   └──────── insertLink / deleteLinkById / updateLinkTitle (lib/data.ts)
     │                         ▲
  getLinks()                   │
     │                  app/actions.ts  (saveLink, removeLink, saveTitle)
     ▼                         ▲
  app/page.tsx  (server)       │  called like normal async functions
     │ props: initialLinks, now│
     ▼                         │
  LinkManager  (client) ───────┘
   state: links, activeTag, query, sortOrder
      ┌─────┴───────────────┐
      │ props: onAdd        │ props: link, activeTag, now,
      │                     │        onDelete, onEditTitle, onTagClick
      ▼                     ▼
  LinkForm             LinkCard × N
```

1. On every request, `app/page.tsx` runs on the server, reads all links with `getLinks()`, and passes them to `LinkManager` as `initialLinks`, together with `now` (the server's current time).
2. `LinkManager` copies them into state (`useState(initialLinks)`). While the page is open, that state is what the screen shows.
3. It passes data and callback functions down to `LinkForm` and `LinkCard`. Children never change the list directly. They call a callback.
4. Each callback updates the state **and** calls a Server Action, which writes to Postgres:
   - **Add** waits for the server first (`await saveLink(link)`), and only shows the link if the server returns `null`. If it returns an error message (for example a duplicate), the link is never shown.
   - **Delete and edit** update the screen first, then `await removeLink(id)` / `await saveTitle(id, title)`. They feel instant and rarely fail.
5. The browser creates the new link with `createLink` (id and `createdAt` included) and sends the **whole link** to `saveLink`. The database stores that same id, so the screen and the database always agree, and deleting a link right after adding it works without reloading.

Because the state already shows each change, actions don't call `refresh()`: the next page load reads the database again anyway.

**Use the updater form after `await`.** Inside an `async` handler, `links` may be out of date by the time the code runs, so always write `setLinks((current) => …)`.

**When a child needs an answer back:** `onAdd(url, title, tags)` returns a Promise of `null` when the link was saved, or an error message (a string) when it wasn't. `LinkManager` decides, and the form shows the message and keeps the input so the user can fix it (it owns the inputs). `saveLink` uses the same pattern between server and browser.

**Raw text up, clean data in `lib/`:** the form sends tags exactly as typed (`"React, news"`). `LinkManager` turns them into a list with `parseTags` before calling `createLink`. The form only deals with what the user typed, and the rules for what a tag is live in one testable function.

**Derived state: store the facts, compute the rest:** `LinkManager` stores four things in state: `links` (every link), `activeTag` (the tag the user clicked, or `null`), `query` (the text in the search box) and `sortOrder` (`"newest"`, `"oldest"` or `"title"`). The list on screen, `visibleLinks`, is a plain `const` computed from them on every render: `sortLinks(searchLinks(filterByTag(links, activeTag), query), sortOrder)`. Each step takes a list and returns a new one, so they chain: first the tag, then the search inside it, then the order. It is never stored with `useState`, so it can't fall out of sync with `links`. Adding, deleting and editing still work on the full `links` list, and the "No links yet" message checks `links`, not `visibleLinks`. When there are links but the filters hide all of them, the page shows "No links match your search." instead. A tag pill doesn't know what filtering is: it calls `onTagClick(tag)`, and `toggleTag` decides. Clicking the selected tag again clears the filter (`setActiveTag((current) => current === tag ? null : tag)`). The card also gets `activeTag`, only to highlight the selected pill and set `aria-pressed`.

**Where state lives:** keep state in the lowest component that needs it. The text typed in the form and its error message only matter to `LinkForm`, so `LinkForm` owns them. The list of links and the filters are needed by the form, the search row and the cards, so they live in their shared parent, `LinkManager`. Whether a card is in edit mode (`isEditing`) and the text being typed (`draft`) only matter to that one card, so each `LinkCard` owns them. The list only hears about an edit when the user presses Save. Cancel just throws the draft away.

**Server and browser must render the same thing (hydration):** the server sends finished HTML, then React renders the same components again in the browser and expects identical output. Anything that changes between the two renders causes a hydration error. That's why the server picks `now` once and passes it down, so `timeAgo(link.createdAt, now)` gives the same text on both sides. The exact-date tooltip uses the computer's time zone, which can legitimately differ between server and browser, so `<time>` has `suppressHydrationWarning`. Use that escape hatch only for values like timestamps, never to hide real bugs.

**Checking links:** `CheckLinksButton` (shown only when there are links) calls the `checkAllLinks` action. The server checks every link with `checkLink`, saves each result with `updateLinkStatus`, and returns the whole list fresh from the database. The button hands it to `onChecked`, which is simply `setLinks`, and shows a summary in a `role="status"` message ("Checked 12 links: 2 broken."). `LinkCard` shows a red **Broken** pill next to the title when `link.status === "broken"`; its tooltip says when it was checked (`timeAgo(checkedAt, now)`).

**Importing links from before v0.5:** `ImportBanner` sits at the top of `LinkManager`. After the first render it reads `localStorage` with `loadLinks()` (reading it during render would make the server and browser output differ). If it finds links, it shows a banner. **Import** calls `importLinks`, deletes the browser's copy with `clearSavedLinks()`, and reports the saved links up with `onImported(imported)`, which `LinkManager` adds to its list. **Not now** only hides the banner until the next visit. The buttons are disabled while importing, so a double click can't import twice.

## 4. Server vs. client components

In the Next.js App Router, components are **Server Components by default**. Add `"use client"` at the top of a file only when it needs:

- state or effects (`useState`, `useEffect`)
- event handlers (`onClick`, `onSubmit`)
- browser APIs (`localStorage`, `window`)

Anything a client component imports becomes client code as well, so you don't need `"use client"` in every file.

| File | Type | Why |
|---|---|---|
| `app/page.tsx` | Server | `async`; reads links with `getLinks()` and renders the heading. Sends no JavaScript of its own to the browser |
| `app/actions.ts` | Server Actions (`"use server"`) | Runs on the server; the browser calls its functions over the network |
| `components/LinkManager.tsx` | Client | Holds `useState` for links, tag filter, search text and sort order; calls the Server Actions |
| `components/ImportBanner.tsx` | Client | Reads old links from `localStorage` after the first render (`useEffect`), offers to import them |
| `components/CheckLinksButton.tsx` | Client | Calls `checkAllLinks`, shows "Checking..." while it runs and a summary when it's done |
| `components/LinkForm.tsx` | Client | Holds input state, handles submit |
| `components/LinkCard.tsx` | Client | Holds edit-mode state (`isEditing`, `draft`), handles Edit/Save/Cancel and tag clicks |

**Keep `"use client"` as low in the tree as possible.** The page fetches data on the server and hands it to one client component that handles everything interactive.

**Props from server to client** must be serializable: plain objects, arrays, strings, numbers, and `Date`s are fine. Functions are not, except Server Actions.

**Server Actions are public.** Next.js turns each one into an address that anyone on the internet can send a request to, skipping your form. So every action **checks its input again on the server**, even if the browser already checked (`saveLink` re-checks for an empty URL and for duplicates). In v1.0, every action must also check *who* is asking.

**Fresh data on every request:** `getLinks()` calls `await connection()` first. Without it, Next.js could render the page once at build time and serve that frozen copy forever. `next build` should show the home page as `ƒ (Dynamic)`.

## 5. Data storage

All reading and writing of links goes through **`lib/data.ts`**. Components and pages never query the database directly.

| Stage | Where links live | Survives refresh? |
|---|---|---|
| v0.1 | React state in memory | ❌ |
| v0.2–v0.4 | Browser `localStorage`, key `linkwell:links` | ✅ (this browser only) |
| **v0.5+ (now)** | **Postgres on Neon**, table `links` | ✅ (any device) |

**The `links` table** (`db/schema.ts`):

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid`, primary key | Sent by the browser (`crypto.randomUUID()`); the database makes one if it's missing |
| `url` | `text`, required | |
| `title` | `text`, can be `null` | `null` = no title (the app uses `undefined`) |
| `tags` | `text[]`, required, default `{}` | Stored lowercase, trimmed, no duplicates (`parseTags`) |
| `created_at` | `timestamp with time zone`, required, default `now()` | A real date in the database; an ISO string in the app |
| `status` | `text` (`"ok"` or `"broken"`), can be `null` | Result of the last link check. `null` = never checked (added in migration `0001`) |
| `checked_at` | `timestamp with time zone`, can be `null` | When the link was last checked |

**`lib/data.ts`** (server-only, all `async`):

| Function | Job |
|---|---|
| `getLinks()` | All links, newest first, converted to `Link` with `toLink`. Calls `connection()` so pages using it render at request time |
| `insertLink(link)` | Inserts one link with its own id and `createdAt` |
| `deleteLinkById(id)` | Deletes the link with that id |
| `updateLinkTitle(id, title)` | Sets a new title (trimmed; blank → `null`) |
| `updateLinkStatus(id, status)` | Saves a check result and sets `checked_at` to now |

**`app/actions.ts`** (Server Actions, called by `LinkManager`):

| Action | Job |
|---|---|
| `saveLink(link)` | Returns `"Please paste a link."` for a blank URL, `"You already saved this link!"` for a duplicate (checked against the database), otherwise saves it and returns `null` |
| `removeLink(id)` | Deletes the link |
| `importLinks(oldLinks)` | Saves links from the browser's `localStorage`. Gives each a fresh id and `tags: []` if missing; skips blank URLs and links already in the database or earlier in the same batch. Returns the links it saved |
| `saveTitle(id, title)` | Saves the new title |
| `checkAllLinks()` | Checks every link **at the same time** (`Promise.all`), saves each result, and returns the list fresh from the database |

**`lib/checkLink.ts`** (server-side, talks to the internet):

`checkLink(url, fetchFn = fetch)` visits a URL and returns `"ok"` or `"broken"`. **Only say "broken" when we're sure**: a wrong Broken badge on a working link is worse than a missed one.

| What happens | Verdict |
|---|---|
| Not an `http://` or `https://` address | broken |
| Answer `404` (not found) or `410` (gone) | broken |
| Error code `ENOTFOUND` (domain doesn't exist) or `ECONNREFUSED` (nothing answers) | broken |
| Any other answer (`200`, `403` blocked, `5xx` temporary problem…) | ok |
| Any other error (timeout after 10 s, expired certificate, `UND_ERR_HEADERS_OVERFLOW`…) | ok |

It uses `GET` with `AbortSignal.timeout(10_000)` and cancels the body right away (`response.body?.cancel()`), so it never downloads whole pages. The error code is in `error.cause.code`.

**`lib/links.ts`** (pure functions, used on both server and browser):

| Function | Job |
|---|---|
| `createLink(url, title?, tags?)` | Builds a new `Link` with a new id and the current time. Trims the title, and turns a blank title into `undefined`. `tags` defaults to `[]` |
| `toLink(row)` | Turns a database row into a `Link`: `Date` → ISO string, `null` → `undefined` (for `title`, `status`, `checkedAt`) |
| `filterByTag(links, tag)` | Links whose `tags` include `tag`. Returns the list unchanged when `tag` is `null`. Links without a `tags` field never match |
| `searchLinks(links, query)` | Links whose URL or title contains `query`, ignoring case and surrounding spaces. Returns the list unchanged when `query` is blank |
| `sortLinks(links, order)` | Returns a **new**, sorted list (copies with `[...links]` first, because `.sort()` changes the array in place). `"newest"` / `"oldest"` compare `createdAt` (ISO strings sort correctly as text). `"title"` sorts A–Z by the name the card shows (title, or domain), ignoring case. Also exports the `SortOrder` type |
| `getDomain(url)` | `https://www.example.com/page` → `example.com`. Returns the text unchanged if it isn't a valid URL |
| `getFaviconUrl(url)` | Address of the site's icon from Google's favicon service (`?domain=…&sz=32`). Returns `null` if it isn't a valid URL |
| `isDuplicate(links, url)` | `true` if the URL is already in the list. Compares normalized URLs (via `new URL().href`), so `https://EXAMPLE.com` matches `https://example.com/` |
| `parseTags(text)` | `"React, news,,react "` → `["react", "news"]`. Splits on commas, trims, lowercases, drops empty tags and duplicates (first one wins) |
| `timeAgo(iso, now?)` | `"just now"`, `"5 minutes ago"`, `"yesterday"`, `"3 weeks ago"`, `"last year"`… Uses the biggest unit that fits and rounds down. `now` defaults to the current time; the page passes the server's time, tests pass a fixed date |
| `updateTitle(links, id, title)` | Returns a **new** list where the matching link has the new title (trimmed; blank → `undefined`). The original list is never modified |
| `loadLinks()` | Reads links saved in `localStorage` before v0.5. Returns `[]` if nothing is saved or the data is broken. Used only by `ImportBanner` |
| `clearSavedLinks()` | Deletes the browser's copy after an import |
| `STORAGE_KEY` | The old storage key (`linkwell:links`), exported so tests use the exact same value |

**Changing the database:**

1. Edit `db/schema.ts`.
2. `npx drizzle-kit generate --name <what_changed>` writes a new numbered SQL file in `drizzle/`. Read it.
3. `npx drizzle-kit migrate` applies it to Neon (it prints nothing on success; check **Tables** in the Neon dashboard).
4. Commit the schema change and the migration together.

Never edit a migration that has already been applied. Make a new one instead.

**Secrets:** `DATABASE_URL` lives only in `.env.local` (ignored by Git). It has no `NEXT_PUBLIC_` prefix, so Next.js never sends it to the browser. `drizzle.config.ts` loads it with `loadEnvConfig` from `@next/env`, because `drizzle-kit` runs outside Next.js.

## 6. Conventions

- **File names:** components use `PascalCase.tsx` (`LinkCard.tsx`). Everything else uses `camelCase.ts` (`links.ts`).
- **One component per file.** Use a default export named after the file.
- **Props types:** define `type <Component>Props` right above the component.
- **Imports:** use the `@/` alias (`@/types/link`), not long relative paths (`../../types/link`).
- **Type-only imports:** use `import type { ... }` for types.
- **Styling:** use Tailwind utility classes in the JSX. Avoid separate CSS files except `app/globals.css`.
- **IDs and dates:** link IDs come from `crypto.randomUUID()`. In the app, dates are ISO strings (`toISOString()`); in the database they're `timestamp with time zone`, and `toLink` / `insertLink` convert between the two. Dates are formatted only for display. The card shows a relative date (`timeAgo(createdAt, now)`) inside `<time dateTime={iso}>`, with the exact date (`toLocaleDateString()`) as a hover tooltip.
- **Optional fields:** new fields on `Link` are optional (`title?: string`), because links saved earlier don't have them. Show a fallback when they're missing (`link.title || getDomain(link.url)`), or check before using them (`link.tags && link.tags.length > 0`).
- **Never change state in place.** Functions like `updateTitle` build a new array (`map`) and new objects (`{ ...link, title }`). React only re-renders when it gets a new value.
- **Images:** use `<Image>` from `next/image` with `width` and `height`. For tiny remote images like favicons (under 1 KB), add `unoptimized`: there's nothing to gain from resizing them, and it means we don't need `remotePatterns` in `next.config.ts`.
- **Accessible names:** every input needs a name: a visible `<label>`, a `placeholder`, or `aria-label` when there's no visible label (the edit box uses `aria-label="Title"`). Lists without a heading get `aria-label` too (the tag list uses `aria-label="Tags"`). Decorative images, like favicons next to a title that already names the site, get `alt=""` so screen readers skip them.
- **Parsing URLs:** use `new URL(...)` inside `try/catch` and fall back to the original text. Old saved data may not be a valid URL, and that must never crash the page.
- **Database code:** files that touch the database start with `import "server-only"`. Always put a `.where(...)` on `update` and `delete` queries; without one, they change every row.
- **Auto-imports:** check the imports at the top of a file after accepting an autocomplete suggestion. VS Code has added `import { get } from "http"` and `import { title } from "process"` by mistake.

## 7. Testing

Tests use **Vitest** with **React Testing Library**, running in `jsdom` (a fake browser).

- **`lib/` functions** get unit tests: call the function, check the result.
- **Pages and components** get tests that act like a user: type into inputs and click buttons, found by role, label or placeholder, never by CSS class. If a test can't find an element by role and name, a screen reader probably can't either. Fix the markup, not the test.
- **Server Components** (`async` ones like `app/page.tsx`) can't be rendered in tests. Test the client component they render instead: `render(<LinkManager initialLinks={[...]} />)`.
- **Never touch the real database in tests.** Replace the module with a fake using `vi.mock("@/app/actions", () => ({ saveLink: vi.fn(async () => null), ... }))` in page tests, and `vi.mock("@/lib/data", ...)` in `actions.test.ts`. Clear the fakes' call records with `vi.clearAllMocks()` in `afterEach`.
- **Checking that the server was asked:** `expect(saveTitle).toHaveBeenCalledWith("1", "New title")`. To make a fake answer differently for one call: `vi.mocked(saveLink).mockResolvedValueOnce("You already saved this link!")`.
- **Async clicks:** when a click starts something async (saving), wrap it in `await act(async () => { fireEvent.click(...) })`, so React finishes the update before the test checks the screen. The `addLink` test helper does this, so tests call `await addLink(...)`.
- **Fake network in tests:** functions that fetch take the fetch function as a parameter (`checkLink(url, fetchFn = fetch)`). Tests pass a fake that returns `new Response(null, { status: 404 })`, or throws an `Error` with `{ cause: { code: "ENOTFOUND" } }` like real `fetch` does. Tests never use the real internet.
- **Browser storage in tests:** tests for the import put old links in with `localStorage.setItem(STORAGE_KEY, JSON.stringify([...]))`, and `afterEach` calls `localStorage.clear()`, so they can't leak into the next test.
- **Old data:** `Link` fields added later stay optional. Give a test an old-style link (without the field) through `initialLinks` and check it still shows.
- **Searching inside one element:** use `within(element)` when the same role appears elsewhere on the page (a tag `listitem` sits inside a card `listitem`).
- **Several matching elements:** `getByRole` fails when more than one element matches (two cards with a `#docs` tag). Use `getAllByRole(...)[0]` when any of them will do.
- **Search box:** an `<input type="search">` has the role `searchbox`; find it with `getByRole("searchbox", { name: "Search links" })`.
- **Decorative images** (`alt=""`) are hidden from role queries on purpose, so tests find them with `document.querySelector("img")`.
- Every new feature comes with tests. Every bug fix gets a test that would have caught the bug.
- `npm run check` (types + lint + tests) must pass before committing.
- **Write the test first** when you can: watch it fail (🔴), then write the code (🟢). A test that never failed hasn't proven anything.
- **Time-dependent code takes `now` as a parameter** (with a default), so tests pass a fixed date and give the same result every day. Pick dates far from today (for example 2020), so a test can't pass by accident because the real clock gives the same answer.
- **Never copy values like storage keys or error messages from one module into another's code.** Import shared values, so a typo can't make a test pass for the wrong reason.

## 8. Decision log

Record important decisions here so the reasons aren't forgotten.

| Date | Decision | Why |
|---|---|---|
| 2026-10-02 | Split `page.tsx` into `LinkForm` and `LinkCard`, move `Link` into `types/` | Smaller files, reusable pieces, one source of truth for the type |
| 2026-10-02 | Keep project code outside `app/` | `app/` stays focused on routing, as one of the layouts in the Next.js docs |
| 2026-10-02 | Link IDs use `crypto.randomUUID()`, dates stored as ISO strings | `Date.now()` IDs can collide; locale date strings can't be sorted or parsed reliably |
| 2026-10-02 | Vitest + React Testing Library for tests | Recommended in the Next.js docs; fast; tests behave like a user. Requires Node 22.12+ |
| 2026-10-03 | Store links in `localStorage` for v0.2 | No server or database needed yet; good enough until accounts and syncing (v0.5) |
| 2026-10-03 | Save in event handlers, load once in `useEffect` | A save effect on `[links]` can overwrite storage with the empty starting list |
| 2026-10-03 | Allow `set-state-in-effect` for the one load effect | One extra render on page open is harmless; `useSyncExternalStore` is overkill for temporary code |
| 2026-10-03 | `title` is optional; cards fall back to the domain | Old saved links have no title, and a domain is more readable than a full URL |
| 2026-10-03 | Duplicates are found by comparing `new URL().href` | The browser already normalizes case and the trailing `/` on a bare domain, so we don't write those rules ourselves |
| 2026-10-03 | `onAdd` returns an error message (`string \| null`) | The page owns the list and decides; the form owns the inputs and shows the message |
| 2026-10-03 | Error message hides after 5 seconds, or as soon as the user types | Short enough to stay out of the way, long enough to read |
| 2026-10-04 | Edit-mode state (`isEditing`, `draft`) lives in `LinkCard`; the page gets `onEditTitle(id, title)` | Only that card needs to know it's being edited; Cancel discards the draft without touching the list |
| 2026-10-04 | `updateTitle` is a pure function in `lib/` that returns a new list | Easy to unit-test; same trim/blank rules as `createLink`; React needs a new array to re-render |
| 2026-10-04 | Cards show the date only, not the time | The time of day isn't useful for a bookmark; cleaner card |
| 2026-10-04 | Favicons come from Google's favicon service | Every site stores its icon differently; one URL pattern works for all. Trade-off: Google sees the domains of saved links |
| 2026-10-04 | Favicons use `<Image unoptimized>` | Icons are under 1 KB, so optimizing them gains nothing, and it avoids `remotePatterns` config (recommended in the Next.js image docs) |
| 2026-10-05 | Relative dates use the built-in `Intl.RelativeTimeFormat` (`"en"`, `numeric: "auto"`) | No library needed; it handles plurals and "yesterday" / "last year". Fixed to English to match the UI and keep tests the same on every machine |
| 2026-10-05 | `timeAgo` takes `now` as a parameter instead of reading the clock | Keeps it a pure function, so tests don't depend on today's date (simpler than faking timers) |
| 2026-10-05 | Months are 30 days, years 365 days, always rounded down | Exact enough for "how long ago"; rounding down never claims a link is older than it is |
| 2026-10-06 | Tags are typed as one comma-separated text box | Simplest input that works; no chip-input component needed yet |
| 2026-10-06 | Tags are stored lowercase, trimmed and without duplicates (`parseTags`) | "React" and "react" must be the same tag, or filtering by tag would miss links |
| 2026-10-06 | The form sends raw tag text; the page calls `parseTags` | The form only handles what the user typed; the tag rules live in one tested `lib/` function |
| 2026-10-06 | New links store `tags: []`; old links have no `tags` field | `tags?` stays optional for old data; the card shows no tag list in either case |
| 2026-10-06 | The visible list is derived (`filterByTag(links, activeTag)`), not stored in state | One source of truth; add/delete/edit can't forget to update a second list |
| 2026-10-06 | One active tag at a time, cleared with "Show all" or by clicking it again | Simplest filter that's useful; combining tags can come later if needed |
| 2026-10-06 | Search matches URL and title only (not tags), as you type, with a plain `includes` | Tags already have their own filter; `includes` is simple and fast enough for a personal list. No search button or debounce needed |
| 2026-10-06 | Search runs inside the active tag filter (`searchLinks(filterByTag(...))`) | Filters combine instead of replacing each other, which is what users expect |
| 2026-10-06 | Sort is the last step of the chain, default `"newest"` | Sorting a smaller list is less work; newest-first matches how links were always shown |
| 2026-10-06 | Title sort uses `localeCompare(..., "en", { sensitivity: "base" })` on the displayed name | Case doesn't change the order; fixed to English so tests match on every machine; sorts what the user sees |
| 2026-10-06 | Selected tag pill is a toggle button (`aria-pressed`) with a solid blue style | Users can see which tag is active and that clicking it again turns it off; screen readers announce it as pressed |
| 2026-10-06 | v0.5 database: **Postgres**, hosted on **Neon** (free tier) | Works locally and on Vercel (v1.0), unlike a SQLite file; the most common web database; "Sign in with Google" libraries (v1.0) store users and sessions in Postgres |
| 2026-10-06 | Talk to the database with **Drizzle** | Queries are written in TypeScript, so `tsc` catches wrong table or column names; small and close to plain SQL |
| 2026-10-06 | The connection string lives in `.env.local` as `DATABASE_URL`, never committed | It's a password; `.gitignore` already ignores `.env*`. No `NEXT_PUBLIC_` prefix, so it never reaches the browser |
| 2026-10-06 | Install `server-only` and import it in `db/index.ts` and `lib/data.ts` | The build fails if a client component ever imports database code, so the connection string can never leak into the browser |
| 2026-10-06 | Split the page: `app/page.tsx` (Server Component, reads the database) + `components/LinkManager.tsx` (Client Component, everything interactive) | Data loads on the server before the page is sent; only the interactive part ships JavaScript |
| 2026-10-06 | Database reads live in `lib/data.ts`, pure helpers stay in `lib/links.ts` | Tests import `lib/links.ts` directly; if it imported the database, every test would try to connect |
| 2026-10-06 | `getLinks()` calls `await connection()` | Without Cache Components, a page with no request-time APIs may be prerendered at build time; this keeps the list fresh on every request |
| 2026-10-07 | Mutations go through Server Actions in `app/actions.ts`, which call `lib/data.ts` | The official doorway from browser to server; client components can't import server-only code |
| 2026-10-07 | `LinkManager` keeps local state and calls the actions, instead of reloading from the server after each change | The screen updates instantly (delete/edit) or right after the server says yes (add); no `refresh()` needed |
| 2026-10-07 | The browser creates the id and `createdAt`, and sends the whole link to `saveLink` | The screen and the database share the same id, so a just-added link can be edited or deleted right away |
| 2026-10-07 | Server Actions re-check their input (blank URL, duplicate) | Actions are public endpoints; never trust the browser. Authentication comes in v1.0 |
| 2026-10-07 | Tests replace `app/actions` and `lib/data` with `vi.mock` fakes | Tests stay fast and never touch the real database |
| 2026-10-07 | The server passes `now` down to `timeAgo`; `<time>` gets `suppressHydrationWarning` for the tooltip | The relative time must match between server and browser renders (hydration); the tooltip's time zone can legitimately differ |
| 2026-10-07 | Old `localStorage` links are imported through a banner the user confirms, not automatically | Nothing reaches the database without the user's say; "Not now" keeps the links in the browser |
| 2026-10-07 | Imported links get fresh ids; duplicates and blank URLs are skipped on the server | Old ids can't clash with database ids; importing twice never creates duplicates; browser data isn't trusted |
| 2026-10-07 | `saveLinks` replaced by `clearSavedLinks`; `loadLinks` and `STORAGE_KEY` stay for the import | Nothing writes to `localStorage` any more; the import still needs to read and then clear it |
| 2026-10-07 | `ImportBanner` reads `localStorage` in `useEffect` (with the `set-state-in-effect` lint disable) | `localStorage` doesn't exist on the server; reading it after the first render keeps server and browser output identical |
| 2026-10-07 | Dead-link checks live in `lib/checkLink.ts` and take `fetch` as a parameter | Network code is slow and unpredictable; injecting `fetch` lets tests fake every answer, like `now` for `timeAgo` |
| 2026-10-07 | Only 404, 410, `ENOTFOUND` and `ECONNREFUSED` mean "broken"; everything else counts as working | A false Broken badge would make users stop trusting badges. Found the hard way: `gemini.google.com` sends headers too large for Node's `fetch` (`UND_ERR_HEADERS_OVERFLOW`) but works fine |
| 2026-10-07 | Use `GET` (not `HEAD`), 10-second timeout, cancel the body | Many servers answer `HEAD` wrongly; the timeout stops one dead server from hanging the check; cancelling avoids downloading pages |
| 2026-10-07 | `status` and `checked_at` are nullable columns; `status` is `text` with a TypeScript-only enum | `null` honestly means "never checked"; no database enum to migrate if more states are added later |
| 2026-10-07 | Links are checked with a button, all at the same time (`Promise.all`) | Simplest first version; in parallel the whole check takes about as long as the slowest link. Automatic, scheduled checks come later |
| 2026-10-07 | The server fetches user-saved URLs, so SSRF protection is required before deploying (v1.0) | While Linkwell only runs locally it's harmless; on the internet, someone could make the server fetch internal addresses |
