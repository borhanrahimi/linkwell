# Architecture

This document explains how Linkwell's code is organized, how data moves through it, and the rules for adding new code. Update it whenever one of those changes.

## 1. Folder layout

Linkwell follows the "store project files outside of `app`" layout from the Next.js docs. `app/` is only for routing (and the Server Actions its pages use). Everything else lives in shared top-level folders.

| Folder | Holds | Rule of thumb |
|---|---|---|
| `app/` | Pages, layouts, Server Actions (`actions.ts`) | If it isn't tied to a URL or called from the browser as an action, it doesn't belong here |
| `components/` | React components | Only UI. Gets data through props, reports user actions through callback props or Server Actions |
| `lib/` | Plain TypeScript functions | No JSX and no React. `links.ts` is pure and easy to test; `data.ts` is the only file that queries the database; `checkLink.ts` and `fetchTitle.ts` are the only files that fetch other websites, and they always go through `safeFetch` in `safeUrl.ts`; `auth.ts` sets up Better Auth on the server, `auth-client.ts` is its browser half, `session.ts` tells Server Actions who is signed in |
| `db/` | Database connection (`index.ts`) and table definitions (`schema.ts`, plus `auth-schema.ts` for Better Auth's `user`, `session`, `account` and `verification` tables) | Server-only. Never imported by a client component |
| `drizzle/` | Generated SQL migrations | Created by `drizzle-kit generate`. Committed, never edited by hand |
| `types/` | Shared type definitions | Only types, no runtime code |
| `__tests__/` | Automated tests | One test file per module (`links.test.ts`, `actions.test.ts`, `page.test.tsx`) |
| `docs/` | Project documentation | |

Root config files: `drizzle.config.ts` (tells `drizzle-kit` where the schema and migrations are) and `.env.local` (your `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `CRON_SECRET`, never committed), and `vercel.json` (the daily cron schedule).

## 2. Layers

The code is split into layers. Each layer may only use the layers **below** it:

```
 ┌──────────────────────────────────────────┐
 │  app/page.tsx      (Server Component)    │  loads links and folders, renders the page
 │  app/actions.ts    (Server Actions)      │  the browser's doorway to the server
 ├──────────────────────────────────────────┤
 │  components/       (Client Components)   │  state, filters, forms, cards
 ├──────────────────────────────────────────┤
 │  lib/data.ts       (server-only)         │  reads and writes the database
 │  lib/links.ts      (pure functions)      │  creates, validates, filters, formats
 ├──────────────────────────────────────────┤
 │  db/               (server-only)         │  connection + table schema
 ├──────────────────────────────────────────┤
 │  types/            (shapes)              │  describes what a Link and a Folder are
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
     │   └──────── insertLink / updateLinkFolder / insertFolder … (lib/data.ts)
     │                         ▲
  getLinks() + getFolders()    │
     │                  app/actions.ts  (saveLink, moveToFolder, createFolder …)
     ▼                         ▲
  app/page.tsx  (server)       │  called like normal async functions
     │ props: initialLinks,    │
     │   initialFolders, now   │
     ▼                         │
  LinkManager  (client) ───────┘
   state: links, folders, activeFolder, activeTag, query, sortOrder
      │
      ├── LinkForm        props: onAdd
      ├── FolderBar       props: folders, activeFolder, onSelect, onCreate
      ├── FolderActions   props: folder, onRename, onDelete  (only when a folder is selected)
      └── LinkCard × N    props: link, folders, activeTag, now, onDelete,
                                 onEditTitle, onMove, onTagClick, onToggleRead
```

1. On every request, `app/page.tsx` runs on the server, reads all links and all folders at the same time (`Promise.all([getLinks(), getFolders()])`), and passes them to `LinkManager` as `initialLinks` and `initialFolders`, together with `now` (the server's current time).
2. `LinkManager` copies them into state (`useState(initialLinks)`, `useState(initialFolders)`). While the page is open, that state is what the screen shows.
3. It passes data and callback functions down to `LinkForm` and `LinkCard`. Children never change the list directly. They call a callback.
4. Each callback updates the state **and** calls a Server Action, which writes to Postgres:
   - **Add** waits for the server first (`await saveLink(link)`). The server answers with either an error message (a string, for example a duplicate) or the **saved link**, possibly with a title it fetched from the page. Only the saved link is shown, so the card always matches the database.
   - **Delete and edit** update the screen first, then `await removeLink(id)` / `await saveTitle(id, title)`. They feel instant and rarely fail.
5. The browser creates the new link with `createLink` (id and `createdAt` included) and sends the **whole link** to `saveLink`. The database stores that same id, so the screen and the database always agree, and deleting a link right after adding it works without reloading.

Because the state already shows each change, actions don't call `refresh()`: the next page load reads the database again anyway.

**Use the updater form after `await`.** Inside an `async` handler, `links` may be out of date by the time the code runs, so always write `setLinks((current) => …)`.

**When a child needs an answer back:** `onAdd(url, title, tags)` returns a Promise of `null` when the link was saved, or an error message (a string) when it wasn't. `LinkManager` decides, and the form shows the message and keeps the input so the user can fix it (it owns the inputs). Between server and browser, `saveLink` returns `Link | string`, and `LinkManager` tells them apart with `typeof result === "string"` (TypeScript then knows the other case is a `Link`).

**Raw text up, clean data in `lib/`:** the form sends tags exactly as typed (`"React, news"`). `LinkManager` turns them into a list with `parseTags` before calling `createLink`. The form only deals with what the user typed, and the rules for what a tag is live in one testable function.

**Derived state: store the facts, compute the rest:** `LinkManager` stores these facts in state: `links` (every link), `activeFolder` (the folder the user clicked, or `null` for all links), `activeTag` (the tag the user clicked, or `null`), `query` (the text in the search box) and `sortOrder` (`"newest"`, `"oldest"` or `"title"`). The list on screen, `visibleLinks`, is a plain `const` computed from them on every render: `sortLinks(searchLinks(filterByTag(filterByFolder(links, activeFolder), activeTag), query), sortOrder)`. Each step takes a list and returns a new one, so they chain: first the folder, then the tag, then the search inside it, then the order. It is never stored with `useState`, so it can't fall out of sync with `links`. Adding, deleting and editing still work on the full `links` list, and the "No links yet" message checks `links`, not `visibleLinks`. When there are links but the filters hide all of them, the page shows "No links match your search." instead, or "No links in this folder yet." when only a folder is selected (no tag, no search). A tag pill doesn't know what filtering is: it calls `onTagClick(tag)`, and `toggleTag` decides. Clicking the selected tag again clears the filter (`setActiveTag((current) => current === tag ? null : tag)`). The card also gets `activeTag`, only to highlight the selected pill and set `aria-pressed`.

**Where state lives:** keep state in the lowest component that needs it. The text typed in the form and its error message only matter to `LinkForm`, so `LinkForm` owns them. The list of links and the filters are needed by the form, the search row and the cards, so they live in their shared parent, `LinkManager`. Whether a card is in edit mode (`isEditing`) and the text being typed (`draft`) only matter to that one card, so each `LinkCard` owns them. The list only hears about an edit when the user presses Save. Cancel just throws the draft away.

**Server and browser must render the same thing (hydration):** the server sends finished HTML, then React renders the same components again in the browser and expects identical output. Anything that changes between the two renders causes a hydration error. That's why the server picks `now` once and passes it down, so `timeAgo(link.createdAt, now)` gives the same text on both sides. The exact-date tooltip uses the computer's time zone, which can legitimately differ between server and browser, so `<time>` has `suppressHydrationWarning`. Use that escape hatch only for values like timestamps, never to hide real bugs.

**Checking links:** `CheckLinksButton` (shown only when there are links) calls the `checkAllLinks` action. The server checks every link with `checkLink`, saves each result with `updateLinkStatus`, and returns the whole list fresh from the database. The button hands it to `onChecked`, which is simply `setLinks`, and shows a summary in a `role="status"` message ("Checked 12 links: 2 broken."). `LinkCard` shows a red **Broken** pill next to the title when `link.status === "broken"`; its tooltip says when it was checked (`timeAgo(checkedAt, now)`). Broken cards also get a **View archived copy** link (`getArchiveUrl`), which opens the Wayback Machine in a new tab.

**Read and unread:** each card has a **Mark read** / **Mark unread** button (`onToggleRead`). `LinkManager.toggleRead` updates the screen first with `setReadAt` (read cards get `opacity-60`), then calls `saveReadStatus(id, read)`. The browser only says read or not; the server picks the time.

**Rediscover:** `LinkManager` computes `const rediscover = now ? pickRediscover(links, now) : []` on every render (derived state, like `visibleLinks`) and shows `<Rediscover>` right under the form. Marking a link as read removes it from the box automatically. It only runs when the server's `now` is passed in, because "more than a week ago" depends on the clock, and server and browser must agree (hydration). Tests that don't pass `now` don't see the box.

**Folders:** each link has at most one folder (`folderId`); tags stay for "what it's about". `FolderBar` (above the search row) shows an **All links** pill and one 📁 pill per folder, each with `aria-pressed`. Clicking a folder calls `onSelect`; clicking the selected one again goes back to all links, like tags. **+ New folder** opens a small form. `LinkManager.addFolder` waits for `createFolder` (the server gives the folder its id) and either adds the folder or hands the error back to the form. Each card gets a `<select aria-label="Folder">` ("No folder" + every folder, shown only when folders exist); `moveLink` updates the screen with `setFolder` first, then calls `moveToFolder`. When a folder is selected, `FolderActions` shows **Rename folder** and **Delete folder** under the bar. It gets `key={selectedFolder.id}`, so switching folders starts it fresh (closing a half-typed rename). Rename waits for `renameFolder`, because the name might be taken. Delete asks with `window.confirm` first, then updates the screen at once: the folder leaves `folders`, its links lose their `folderId` (`clearFolder`), and the view goes back to all links. In the database, `ON DELETE SET NULL` does the same to the links' `folder_id`, so screen and database agree without an extra query.

**Importing links from before v0.5:** `ImportBanner` sits at the top of `LinkManager`. After the first render it reads `localStorage` with `loadLinks()` (reading it during render would make the server and browser output differ). If it finds links, it shows a banner. **Import** calls `importLinks`, deletes the browser's copy with `clearSavedLinks()`, and reports the saved links up with `onImported(imported)`, which `LinkManager` adds to its list. **Not now** only hides the banner until the next visit. The buttons are disabled while importing, so a double click can't import twice.

## 4. Server vs. client components

In the Next.js App Router, components are **Server Components by default**. Add `"use client"` at the top of a file only when it needs:

- state or effects (`useState`, `useEffect`)
- event handlers (`onClick`, `onSubmit`)
- browser APIs (`localStorage`, `window`)

Anything a client component imports becomes client code as well, so you don't need `"use client"` in every file.

| File | Type | Why |
|---|---|---|
| `app/page.tsx` | Server | `async`; reads the session with `auth.api.getSession`. Signed out: shows the sign-in screen. Signed in: shows who is signed in, reads links with `getLinks()` and renders the heading. Sends no JavaScript of its own to the browser |
| `app/api/auth/[...all]/route.ts` | Route Handler | Hands every `/api/auth/*` request (sign in, Google callback, sign out) to Better Auth |
| `app/api/cron/check-links/route.ts` | Route Handler | Called daily by Vercel Cron. Checks the secret, then checks every user's links with `getLinksToCheck()` and saves each result for its owner |
| `components/SignInButton.tsx` | Client | Calls `authClient.signIn.social({ provider: "google" })` on click |
| `components/SignOutButton.tsx` | Client | Calls `authClient.signOut()`, then `router.refresh()` so the server page renders again and finds no session |
| `app/actions.ts` | Server Actions (`"use server"`) | Runs on the server; the browser calls its functions over the network |
| `components/LinkManager.tsx` | Client | Holds `useState` for links, folders, folder and tag filters, search text and sort order; calls the Server Actions. Lays out the bento grid: the dashboard tiles and the grid of `LinkCard`s |
| `components/ImportBanner.tsx` | Client | Reads old links from `localStorage` after the first render (`useEffect`), offers to import them |
| `components/CheckLinksButton.tsx` | Client | Calls `checkAllLinks`, shows "Checking..." while it runs and a summary when it's done |
| `components/Rediscover.tsx` | Client (imported by `LinkManager`) | No state: shows the links it's given in a named `<section>`. Takes a `className` so the grid can make it wide. Has no `"use client"` of its own |
| `components/Overview.tsx` | Client (imported by `LinkManager`) | No state: shows `countLinks(links)` (saved, unread, broken) as a `<dl>`, plus the `CheckLinksButton`. Has no `"use client"` of its own |
| `components/FolderBar.tsx` | Client | Folder pills (select a folder) and the "+ New folder" form with its own input and error state |
| `components/FolderActions.tsx` | Client | Rename form and Delete button for the selected folder; asks `window.confirm` before deleting |
| `components/LinkForm.tsx` | Client | Holds input state, handles submit |
| `components/LinkCard.tsx` | Client | Holds edit-mode state (`isEditing`, `draft`), handles Edit/Save/Cancel and tag clicks |

**Keep `"use client"` as low in the tree as possible.** The page fetches data on the server and hands it to one client component that handles everything interactive.

**Props from server to client** must be serializable: plain objects, arrays, strings, numbers, and `Date`s are fine. Functions are not, except Server Actions.

**Server Actions are public.** Next.js turns each one into an address that anyone on the internet can send a request to, skipping your form. So every action **checks its input again on the server**, even if the browser already checked (`saveLink` re-checks for an empty URL and for duplicates). Every action also starts with `await getUserId()` (`lib/session.ts`), which throws when nobody is signed in, and passes that id to `lib/data.ts`. Every function in `lib/data.ts` takes the user id first and only reads or changes that user's rows: updates and deletes match on the row's id **and** `user_id`, so sending someone else's link id changes nothing. A new action must follow the same pattern.

**Fresh data on every request:** `getLinks()` calls `await connection()` first. Without it, Next.js could render the page once at build time and serve that frozen copy forever. `next build` should show the home page as `ƒ (Dynamic)`.

## 5. Data storage

All reading and writing of links and folders goes through **`lib/data.ts`**. Components and pages never query the database directly.

| Stage | Where links live | Survives refresh? |
|---|---|---|
| v0.1 | React state in memory | ❌ |
| v0.2–v0.4 | Browser `localStorage`, key `linkwell:links` | ✅ (this browser only) |
| **v0.5+ (now)** | **Postgres on Neon**, tables `links` and `folders` (v0.8) | ✅ (any device) |

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
| `read_at` | `timestamp with time zone`, can be `null` | `null` = still to read; a date = read, and when (migration `0002`) |
| `folder_id` | `uuid`, can be `null`, foreign key → `folders.id`, `ON DELETE SET NULL` | `null` = no folder. The database refuses a folder id that doesn't exist, and empties this column when its folder is deleted (migration `0003`) |

**The `folders` table** (`db/schema.ts`, migration `0003`; defined above `links` because `links` points to it):

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid`, primary key, default random | Made by the database (unlike links, the browser doesn't need the id before the server answers) |
| `name` | `text`, required | Trimmed. Unique ignoring case, checked by the actions, not the database |
| `created_at` | `timestamp with time zone`, required, default `now()` | Folders are listed oldest first, so new ones appear at the end |

**`lib/data.ts`** (server-only, all `async`):

| Function | Job |
|---|---|
| `getLinks()` | All links, newest first, converted to `Link` with `toLink`. Calls `connection()` so pages using it render at request time |
| `insertLink(link)` | Inserts one link with its own id and `createdAt` |
| `deleteLinkById(id)` | Deletes the link with that id |
| `updateLinkTitle(id, title)` | Sets a new title (trimmed; blank → `null`) |
| `updateLinkStatus(id, status)` | Saves a check result and sets `checked_at` to now |
| `updateLinkReadAt(id, readAt)` | Sets `read_at` to a date (read) or `null` (unread) |
| `updateLinkFolder(id, folderId)` | Moves a link into a folder, or out of it with `null` |
| `getFolders()` | All folders, oldest first, converted with `toFolder` |
| `insertFolder(name)` | Creates a folder and returns it, with the id the database made (`.returning()`) |
| `updateFolderName(id, name)` | Renames a folder |
| `deleteFolderById(id)` | Deletes a folder; Postgres sets its links' `folder_id` to `null` |

**`app/actions.ts`** (Server Actions, called by `LinkManager`):

| Action | Job |
|---|---|
| `saveLink(link)` | Returns `"Please paste a link."` for a blank URL, `"You already saved this link!"` for a duplicate (checked against the database). Otherwise fills in the title with `fetchTitle` if none was typed (`link.title ?? await fetchTitle(url)`), saves it, and returns the saved link |
| `removeLink(id)` | Deletes the link |
| `importLinks(oldLinks)` | Saves links from the browser's `localStorage`. Gives each a fresh id and `tags: []` if missing; skips blank URLs and links already in the database or earlier in the same batch. Returns the links it saved |
| `saveTitle(id, title)` | Saves the new title |
| `saveReadStatus(id, read)` | `true` → `read_at` = now (the server's time, never the browser's); `false` → `null` |
| `moveToFolder(id, folderId)` | Moves a link into a folder (`null` = no folder) |
| `createFolder(name)` | Returns `"Please give the folder a name."` for a blank name, `You already have a folder called "X".` for a duplicate (ignoring case). Otherwise saves the trimmed name and returns the new `Folder` |
| `renameFolder(id, name)` | Same checks as `createFolder`, but only against the *other* folders (renaming "Work" to "work" is fine). Returns an error message, or `null` when it worked |
| `deleteFolder(id)` | Deletes the folder; its links stay, without a folder |
| `checkAllLinks()` | Checks every link **at the same time** (`Promise.all`), saves each result, and returns the list fresh from the database |

**`lib/checkLink.ts`** (server-side, talks to the internet):

`checkLink(url, fetchFn = safeFetch)` visits a URL and returns `"ok"` or `"broken"`. **Only say "broken" when we're sure**: a wrong Broken badge on a working link is worse than a missed one.

| What happens | Verdict |
|---|---|
| Not an `http://` or `https://` address | broken |
| Points to a private or internal address (`BlockedUrlError` from `safeFetch`), or more than 5 redirects | broken |
| Answer `404` (not found) or `410` (gone) | broken |
| Error code `ENOTFOUND` (domain doesn't exist) or `ECONNREFUSED` (nothing answers) | broken |
| Any other answer (`200`, `403` blocked, `5xx` temporary problem…) | ok |
| Any other error (timeout after 10 s, expired certificate, `UND_ERR_HEADERS_OVERFLOW`…) | ok |

It uses `GET` with `AbortSignal.timeout(10_000)` and cancels the body right away (`response.body?.cancel()`), so it never downloads whole pages. The error code is in `error.code` when our own DNS lookup fails (in `safeFetch`), and in `error.cause.code` when `fetch` fails; `checkLink` reads both.

**`lib/fetchTitle.ts`** (server-side, talks to the internet):

| Function | Job |
|---|---|
| `readTitle(html)` | Pure: finds `<title>…</title>` (any case, with attributes), turns common HTML codes like `&amp;` back into characters, squashes spaces and line breaks, cuts at 200 characters. Returns `undefined` if there's no title or it's empty |
| `fetchTitle(url, fetchFn = safeFetch)` | Downloads the page (only `http(s)`, 5-second timeout) and returns `readTitle` of it. Returns `undefined` for anything that isn't an OK HTML page (404, PDF…), when the site can't be reached, or when the address is blocked. Never throws |

**`lib/safeUrl.ts`** (server-side, SSRF protection):

The server fetches URLs that users typed. Without protection, someone could save `http://169.254.169.254/` (the cloud metadata address, where a server's secret keys live) or `http://localhost:5432` and make our server fetch it for them. This is called **SSRF** (server-side request forgery). Every fetch of a user's URL goes through `safeFetch`.

| Function | Job |
|---|---|
| `isPrivateAddress(ip)` | `true` for loopback (`127.0.0.0/8`, `::1`), private networks (`10/8`, `172.16/12`, `192.168/16`, `fc00::/7`), link-local and cloud metadata (`169.254/16`, `fe80::/10`), carrier-grade NAT, multicast and reserved ranges, using Node's `BlockList`. Unwraps IPv4 hidden in IPv6 (`::ffff:127.0.0.1`). Anything that isn't an IP address counts as private (fail closed) |
| `assertPublicUrl(url, lookupFn)` | Throws `BlockedUrlError` unless the URL is `http(s)` and **every** address its hostname resolves to is public (`dns.lookup` with `all: true`). IP addresses typed into the URL are checked directly, without a lookup (brackets around IPv6 are removed first) |
| `safeFetch(url, init, fetchFn, lookupFn)` | Like `fetch`, but checks the URL first and follows redirects itself (`redirect: "manual"`), checking every hop before requesting it. Gives up after 5 redirects (`BlockedUrlError`) |
| `BlockedUrlError` | The error for "refused on purpose", so callers can tell it apart from network problems with `instanceof` |
| `FetchFn` | `(url: string, init?: RequestInit) => Promise<Response>`: the shape `checkLink` and `fetchTitle` accept. Both `safeFetch` and the tests' fake `fetch` functions fit it |

**Known limit (DNS rebinding):** we look up the name, then `fetch` looks it up **again** when it connects. A tricky DNS server could answer "public" the first time and "private" the second. The full fix is to make `fetch` connect to the exact address we checked (an `undici` `Agent` with a custom `connect.lookup`). It's left out for now: the attack needs a DNS server built for it, and most hosting platforms (like Vercel) don't expose sensitive internal addresses anyway.

**`lib/links.ts`** (pure functions, used on both server and browser):

| Function | Job |
|---|---|
| `createLink(url, title?, tags?)` | Builds a new `Link` with a new id and the current time. Trims the title, and turns a blank title into `undefined`. `tags` defaults to `[]` |
| `toLink(row)` | Turns a database row into a `Link`: `Date` → ISO string, `null` → `undefined` (for `title`, `status`, `checkedAt`, `readAt`, `folderId`) |
| `toFolder(row)` | Turns a database row into a `Folder` (`{ id, name }`) |
| `filterByTag(links, tag)` | Links whose `tags` include `tag`. Returns the list unchanged when `tag` is `null`. Links without a `tags` field never match |
| `filterByFolder(links, folderId)` | Links in that folder. Returns the list unchanged when `folderId` is `null` |
| `searchLinks(links, query)` | Links whose URL or title contains `query`, ignoring case and surrounding spaces. Returns the list unchanged when `query` is blank |
| `sortLinks(links, order)` | Returns a **new**, sorted list (copies with `[...links]` first, because `.sort()` changes the array in place). `"newest"` / `"oldest"` compare `createdAt` (ISO strings sort correctly as text). `"title"` sorts A–Z by the name the card shows (title, or domain), ignoring case. Also exports the `SortOrder` type |
| `setReadAt(links, id, readAt)` | Returns a **new** list where the matching link has the new `readAt` (a date, or `undefined` for unread) |
| `setFolder(links, id, folderId)` | Returns a **new** list where the matching link is in the new folder (`undefined` = no folder) |
| `clearFolder(links, folderId)` | Returns a **new** list where no link is in that folder anymore (what `ON DELETE SET NULL` does in the database) |
| `pickRediscover(links, now, count = 3)` | Unread, not broken links saved more than a week before `now`, oldest first, at most `count`. Deterministic (no randomness), so server and browser pick the same links |
| `getArchiveUrl(url)` | `https://web.archive.org/web/<url>`: the Wayback Machine jumps to its newest saved copy of the page, or says it has none |
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

**Secrets:** `DATABASE_URL` lives only in `.env.local` (ignored by Git). It has no `NEXT_PUBLIC_` prefix, so Next.js never sends it to the browser. `drizzle.config.ts` loads it with `loadEnvConfig` from `@next/env`, because `drizzle-kit` runs outside Next.js. The auth settings live there too: `BETTER_AUTH_SECRET` (a random string, for example from `openssl rand -base64 32`, that signs session cookies; changing it signs everyone out), `BETTER_AUTH_URL` (the app's address, `http://localhost:3000` locally) and `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from Google Cloud Console. Google only sends users back to redirect URIs listed there, so `http://localhost:3000/api/auth/callback/google` must be one of them (and the deployed address, in v1.0). Restart `npm run dev` after changing `.env.local`.

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

Tests use **Vitest** with **React Testing Library**, running in `jsdom` (a fake browser). On top of that, a few **Playwright** tests in `e2e/` click through the real app in a real browser (see "Browser tests" below).

- **`lib/` functions** get unit tests: call the function, check the result.
- **Pages and components** get tests that act like a user: type into inputs and click buttons, found by role, label or placeholder, never by CSS class. If a test can't find an element by role and name, a screen reader probably can't either. Fix the markup, not the test.
- **Server Components** (`async` ones like `app/page.tsx`) can't be rendered in tests. Test the client component they render instead: `render(<LinkManager initialLinks={[...]} />)`.
- **Never touch the real database in tests.** Replace the module with a fake using `vi.mock("@/app/actions", () => ({ saveLink: vi.fn(async () => null), ... }))` in page tests, and `vi.mock("@/lib/data", ...)` in `actions.test.ts`. Clear the fakes' call records with `vi.clearAllMocks()` in `afterEach`.
- **Checking that the server was asked:** `expect(saveTitle).toHaveBeenCalledWith("1", "New title")`. To make a fake answer differently for one call: `vi.mocked(saveLink).mockResolvedValueOnce("You already saved this link!")`.
- **Async clicks:** when a click starts something async (saving), wrap it in `await act(async () => { fireEvent.click(...) })`, so React finishes the update before the test checks the screen. The `addLink` test helper does this, so tests call `await addLink(...)`.
- **Fake network in tests:** functions that fetch take the fetch function as a parameter (`checkLink(url, fetchFn = safeFetch)`, `fetchTitle(url, fetchFn = safeFetch)`). Passing a fake skips `safeFetch`, so the SSRF checks are tested on their own in `safeUrl.test.ts`, with a fake DNS lookup (`LookupFn`) and a fake site whose URLs either redirect or answer with a status code. Tests pass a fake that returns `new Response(null, { status: 404 })` or `new Response("<title>Hi</title>", { headers: { "content-type": "text/html" } })`, or throws an `Error` with `{ cause: { code: "ENOTFOUND" } }` like real `fetch` does. Tests never use the real internet.
- **Looking inside one area:** when the same link appears twice (in Rediscover and in the list), find the area first and search inside it: `within(screen.getByRole("region", { name: "Rediscover" }))`. A `<section>` becomes a `region` once it has a name (`aria-labelledby` pointing to its heading).
- **Confirm dialogs:** jsdom has no real `window.confirm`. Fake the answer for one click with `vi.spyOn(window, "confirm").mockReturnValueOnce(true)` (or `false` to test Cancel).
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

**Browser tests (Playwright, `npm run e2e`):**

- They cover what the fake-browser tests can't: the real server, the real database, sessions and cookies. Keep them few, one per important path (signed out, sign in and out, saving survives a reload, accounts are kept apart). Details belong in the Vitest tests.
- `playwright.config.ts` builds the app and starts it on port 3100, with `DATABASE_URL` set to `E2E_DATABASE_URL` (a Neon branch called `e2e`) and `BETTER_AUTH_URL` set to `http://localhost:3100`. The real database is never touched, and `npm run dev` on port 3000 can keep running.
- **Signing in without Google:** `e2e/fixtures.ts` makes a second Better Auth instance with the `testUtils` plugin, the same secret and the test database. Its `signIn(name)` fixture saves a brand-new user and puts a real, signed session cookie in the browser. The plugin lives only in the tests, never in `lib/auth.ts`.
- Each test signs in its own new user, and the users are deleted afterwards (their links and folders go with them through `ON DELETE CASCADE`). Tests can run in parallel and never see each other's data.
- Find elements the same way as in Vitest tests: by role, label or placeholder. Type a title when saving a link, so the server doesn't fetch the page.
- When you add a migration, apply it to the test branch too: `DATABASE_URL="$(grep '^E2E_DATABASE_URL=' .env.local | cut -d= -f2-)" npx drizzle-kit migrate`.
- Vitest skips `e2e/` (`exclude` in `vitest.config.mts`), so `npm run check` stays fast and doesn't need the test database.

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
| 2026-10-08 | Archived copies use `https://web.archive.org/web/<url>` as a plain link, without calling the Wayback API | The Wayback Machine redirects to its newest copy by itself; no server code, no waiting, nothing to store |
| 2026-10-08 | Titles are fetched on the server while saving, only when the user typed none; a typed title always wins | The user's own title is better than the page's; fetching once at save time keeps the card fast afterwards |
| 2026-10-08 | `fetchTitle` uses a regex on the HTML, a 5-second timeout, and never throws | Reading one `<title>` doesn't need an HTML parser library; saving shouldn't feel slow; a failed fetch just means "no title" |
| 2026-10-08 | `saveLink` returns `Link \| string` instead of `string \| null` | The browser needs the server's final version of the link (with the fetched title) to show it |
| 2026-10-08 | Scheduled link checks moved from v0.6 to v1.0 | Something has to wake the app up on a schedule, which needs a deployed app (for example Vercel Cron); locally nothing runs while the laptop is closed |
| 2026-10-09 | Read status is a `read_at` timestamp, not a true/false column | Same cost, but also records *when*, which Rediscover and future stats can use |
| 2026-10-09 | The server sets `read_at`; the browser only sends `read: true/false` | Never trust times sent by the browser |
| 2026-10-09 | Read links fade (`opacity-60`) instead of disappearing | You can still find them; unread links stand out |
| 2026-10-09 | Rediscover picks unread, not-broken links older than a week, oldest first, at most 3 | Random picks would differ between server and browser renders (hydration error); oldest first is fair and predictable |
| 2026-10-09 | The weekly email digest is optional and moved to Later / ideas | Rediscover already covers "come back to them" inside the app; email needs deployment, accounts, a schedule and an email service |
| 2026-10-09 | Each link has at most one folder (`folder_id` on `links`), and tags stay | A folder answers "where does it belong", tags answer "what is it about". One folder per link needs no extra table; several folders per link would need a join table |
| 2026-10-09 | Deleting a folder sets its links' `folder_id` to `null` (`ON DELETE SET NULL`) | Deleting a folder should never delete links. `CASCADE` would; `RESTRICT` would force emptying the folder first |
| 2026-10-09 | Folder ids are made by the database, link ids by the browser | A new folder can wait for the server's answer before it shows; links are shown and deleted right away, so the browser needs the id first |
| 2026-10-09 | Folder names are unique ignoring case, checked in the actions | "Work" and "work" side by side would be confusing. A database `UNIQUE` index can come with accounts (unique per user) |
| 2026-10-09 | Links and folders load as two lists and are matched in the browser, no SQL join | The page needs every folder anyway (even empty ones), and filtering by folder is a simple `filter`, like tags |
| 2026-10-09 | The folder filter is the first step of the `visibleLinks` chain (`filterByFolder`) | Works together with tag, search and sort for free |
| 2026-10-17 | SSRF protection in `lib/safeUrl.ts`: check every address a hostname resolves to against a list of private ranges (Node's `BlockList`), before every request | Blocking names like `localhost` isn't enough: any domain can point to `127.0.0.1`. Checking the resolved addresses catches all of them; no library needed |
| 2026-10-17 | `safeFetch` follows redirects itself (`redirect: "manual"`, at most 5) and checks each hop | With automatic redirects, a public site could send our server on to a private address without us seeing it |
| 2026-10-17 | `safeFetch` is the default `fetchFn` of `checkLink` and `fetchTitle`; blocked links count as broken / no title | The app is protected without changing the callers; existing tests keep passing their fake `fetch` |
| 2026-10-17 | Anything unclear (not an IP, no addresses, not a URL) is blocked (fail closed) | For security checks, a wrong "blocked" is a small bug; a wrong "allowed" is a hole |
| 2026-10-17 | DNS rebinding is not handled yet (we look up the name, then `fetch` looks it up again) | The full fix (`undici` `Agent` with `connect.lookup`) adds complexity; the attack needs a special DNS server, and the risk is low on Vercel. Revisit if Linkwell runs on a server with sensitive internal services |
| 2026-10-17 | Accounts with **Better Auth**, Google as the only sign-in method | Stores users and sessions in our own Postgres through the Drizzle adapter, so there's no extra service. Google sign-in means no passwords to store, reset or leak |
| 2026-10-17 | `app/page.tsx` checks the session on the server and shows a sign-in screen when there is none | Signed-out visitors never receive the link data. No middleware needed while there is only one page |
| 2026-10-17 | Sign-out runs in the browser (`authClient.signOut()`), followed by `router.refresh()` | Better Auth clears the session cookie; the refresh makes the Server Component check again and show the sign-in screen |
| 2026-10-17 | Links and folders are not tied to users yet, and Server Actions don't check the session yet | Done in small steps: sign-in first, then a `user_id` column and session checks in every action. Until then, every signed-in user sees the same links |
| 2026-10-18 | `links` and `folders` get a required `user_id` that points to `user.id`, `ON DELETE CASCADE` | Every row has an owner. Deleting an account deletes its links and folders, instead of leaving data nobody can reach |
| 2026-10-18 | Three migrations: add `user_id` as optional, give existing rows to the first user (a `--custom` migration), then make it required | A new required column can't be added to a table that already has rows. The links saved before accounts existed belong to the app's first user |
| 2026-10-18 | The user id comes from the session on the server (`getUserId()`), never from the browser | The browser could send any id. The session cookie is signed with `BETTER_AUTH_SECRET`, so it can't be faked |
| 2026-10-18 | `lib/data.ts` functions take `userId` as their first parameter and filter on it (`ownLink`, `ownFolder`) | Forgetting the filter becomes a type error, not a data leak. Checking ownership inside the query needs no extra read first |
| 2026-10-18 | `moveToFolder` does nothing if the folder isn't one of the user's own | Otherwise a link could be put into another user's folder by guessing its id |
| 2026-10-18 | Signed-out calls throw instead of returning an error message | The UI only shows these actions to signed-in users, so a signed-out call is a bug or an attack, not something to explain to a user |
| 2026-10-18 | Folder names are still checked for uniqueness in the actions, now per user; no database `UNIQUE` index yet | Two users may both have a "Work" folder. A `UNIQUE (user_id, lower(name))` index can come later if needed |
| 2026-10-18 | Hosted on **Vercel** (free tier), deployed on every push to `main` | Made by the Next.js team, so it needs no setup. Vercel Cron can run the scheduled link checks next |
| 2026-10-18 | Production and local development share one Neon database for now | Only one user, so there's nothing to keep apart yet. A separate Neon branch for development can come before other people sign up |
| 2026-10-18 | `lib/auth.ts` reads its settings through `requireEnv`, which throws with the variable's name | A missing variable on Vercel shows up as a clear error in the logs, instead of a 500 on sign-in |
| 2026-10-18 | Sign-in only works on the production address, not on Vercel preview deployments | Previews get a new address each time, and Google only accepts redirect URIs listed in advance |
| 2026-10-18 | Daily link checks: Vercel Cron calls `GET /api/cron/check-links` at 06:00 UTC (`vercel.json`) | The free plan allows one run a day, which is enough to catch dead links. The Check links button still works for a check right away |
| 2026-10-18 | The cron route requires `Authorization: Bearer <CRON_SECRET>`, and refuses everything when `CRON_SECRET` isn't set | It's a public address that makes the server fetch every saved link; without the secret, anyone could trigger that over and over. Failing closed means a missing variable can't open it up |
| 2026-10-18 | `getLinksToCheck()` is the only `lib/data.ts` function without a `userId`, and returns each link's owner | The cron job works for all users at once, and `updateLinkStatus` still needs the owner's id. Only the cron route may call it, never a Server Action |
| 2026-10-18 | The cron route checks all links at the same time (`Promise.all`), like the button | Fine for a handful of users. With many links, it should check in batches so it stays within Vercel's time limit |
| 2026-10-18 | End-to-end tests with **Playwright**, Chromium only | The standard tool, with Next.js docs for it. One browser is enough to catch broken flows; more can come with the redesign |
| 2026-10-18 | Browser tests use their own Neon branch (`e2e`, copied from production with data, never auto-deleted) | Tests create and delete users and links, which must never happen in the real database. Copying with data also copies Drizzle's migration records, so `drizzle-kit migrate` works on the branch |
| 2026-10-18 | Tests sign in through Better Auth's `testUtils` plugin, in a test-only auth instance | Google's login page can't be automated (and shouldn't be). The cookie is signed with the real secret, so the app treats it like a normal session; nothing test-only ships to production |
| 2026-10-18 | Playwright runs a production build (`next build && next start`) on port 3100 | Tests what Vercel runs, and doesn't clash with `npm run dev` on port 3000 |
| 2026-10-18 | v1.1 layout: **dashboard + card grid** (chosen over a sidebar, or mixing controls and links in one grid) | The tools (save, overview, Rediscover, folders) stay together at the top, and links get the full width below. Easy to scan on desktop, and it stacks into one column on phones |
| 2026-10-18 | The dashboard is `grid-cols-1 md:grid-cols-3`; the link list is `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` | Mobile first: one column by default, more as the screen grows. `grid-cols-1` (not leaving the column count out) stops long URLs from stretching the grid wider than a phone screen |
| 2026-10-18 | When Rediscover is empty, the Folders tile spans the whole row | A grid with a missing tile would leave a hole next to Folders |
| 2026-10-18 | Broken links keep the same card size, with a red outline (`ring-1 ring-red-300`) and the Broken badge | A double-width card was tried first, but uneven card sizes looked out of place; the outline and badge are enough to stand out |
| 2026-10-18 | New `countLinks()` in `lib/links.ts` feeds the Overview tile | A pure function, so the counting is tested without rendering anything; the tile only shows the numbers |
| 2026-10-18 | Favicons are fetched at 64px and shown at 24px inside a fixed rounded tile, with the domain's first letter when there's no icon | 32px icons looked blurry on retina screens, and icons of different shapes didn't line up |
| 2026-10-18 | Inputs inside flex rows get `min-w-0` | Flex and grid items don't shrink below their content's width by default, which pushed buttons out of their tiles on narrow screens |
