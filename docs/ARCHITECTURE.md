# Architecture

This document explains how Linkwell's code is organized, how data moves through it, and the rules for adding new code. Update it whenever one of those changes.

## 1. Folder layout

Linkwell follows the "store project files outside of `app`" layout from the Next.js docs. `app/` is only for routing (and the Server Actions its pages use). Everything else lives in shared top-level folders.

| Folder | Holds | Rule of thumb |
|---|---|---|
| `app/` | Pages, layouts, Server Actions (`actions.ts`) | If it isn't tied to a URL or called from the browser as an action, it doesn't belong here |
| `components/` | React components | Only UI. Gets data through props, reports user actions through callback props or Server Actions. `components/illustrations/` holds the drawings (one SVG component each, decoration only) |
| `lib/` | Plain TypeScript functions | No JSX and no React. `links.ts` is pure and easy to test; `data.ts` is the only file that queries the database; `checkLink.ts` and `fetchTitle.ts` are the only files that fetch other websites, and they always go through `safeFetch` in `safeUrl.ts`; `auth.ts` sets up Better Auth on the server, `auth-client.ts` is its browser half, `session.ts` tells Server Actions who is signed in, `username.ts` holds the username rules, `bookmarks.ts` writes and reads bookmarks files (`parseBookmarksHtml` uses the browser's `DOMParser`, so only client code and tests call it) and `share.ts` helps `/share` and the bookmarklet, `folders.ts` holds the folder palette and icon list (all pure) |
| `db/` | Database connection (`index.ts`) and table definitions (`schema.ts`, plus `auth-schema.ts` for Better Auth's `user`, `session`, `account` and `verification` tables) | Server-only. Never imported by a client component |
| `drizzle/` | Generated SQL migrations | Created by `drizzle-kit generate`. Committed, never edited by hand |
| `types/` | Shared type definitions | Only types, no runtime code |
| `__tests__/` | Automated tests | One test file per module (`links.test.ts`, `actions.test.ts`, `page.test.tsx`) |
| `docs/` | Project documentation | |
| `public/` | Files served as they are (`public/icon-192.png` → `/icon-192.png`) | The installable app's icons. Favicons and the iPhone icon stay in `app/` (`icon.svg`, `apple-icon.png`) |
| `extension/` | The Chrome extension: `manifest.json`, `background.js`, `icons/` | Plain JavaScript, not part of the Next.js app. It only opens `/share`; it never saves anything itself |

Root files: `proxy.ts` (runs before every page: makes a nonce and sends the Content-Security-Policy, see `lib/csp.ts`), `next.config.ts` (security headers for every response), `drizzle.config.ts` (tells `drizzle-kit` where the schema and migrations are) and `.env.local` (your `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `CRON_SECRET`, never committed), and `vercel.json` (the daily cron schedule).

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
| `app/page.tsx` | Server | `async`; reads the session with `auth.api.getSession`. Signed out: shows `Landing` (with `deleted` after an account was deleted). Signed in: reads links and folders, and shows `LinkManager` (which draws the top bar), passing the address's query (`searchParams`) as `initialSearch` so the first render shows the chosen list. Sends no JavaScript of its own to the browser |
| `app/privacy/page.tsx`, `app/terms/page.tsx` | Server | The privacy policy and terms, in plain language, inside `LegalPage` (title, date from `SITE.legalUpdated`, readable `.legal` text styles). They call `connection()` so they render per request: a page built ahead of time would have no nonce, and the Content-Security-Policy would block its scripts. Keep them true whenever a feature changes what's stored |
| `app/layout.tsx` | Server | The root layout, and the metadata every page shares: `metadataBase` (`SITE.url`), a title template (`%s · Linkwell`), the description, Open Graph and a large Twitter card. Pages only set their own short `title` |
| `app/opengraph-image.png`, `app/twitter-image.png` (+ `.alt.txt`) | Metadata files | The sharing preview picture, 1200×630: the app icon, the promise and the doodle character waving "Hi!" (`Wave`), screenshotted from a temporary page with Playwright. Next.js adds the `og:image` / `twitter:image` tags, with size and description, to every page |
| `components/Footer.tsx` | Server | Links to Privacy and Terms, under the landing, account and legal pages |
| `components/Landing.tsx` | Server | The landing page for visitors: a bar with Sign in, the promise and **Sign in with Google**, three promise cards with drawings (`EmptyBox`, `LinkDoctor`, `Stargazer`), "Save from anywhere", a FAQ in `<details>` (opens without JavaScript) and a last call to sign in. Only the `SignInButton`s are client components. Under the promise, a "What Linkwell looks like" section: the app's screenshots (`next/image`, from `public/screenshots/`), each as a light and a dark picture where CSS (`dark:hidden` / `dark:block`) shows the one matching the visitor's mode; the hidden one isn't downloaded. Wide screens show the computer view with the phone in front of it; small screens just the phone |
| `e2e/screenshots.spec.ts`, `public/screenshots/` | Script and pictures | Not a test: skipped unless `SCREENSHOTS` is set (`npm run screenshots`). Signs in a test user, imports made-up sample links (folders, tags, dates), marks one read, and saves `app-` and `phone-` `light`/`dark` PNGs at twice the pixels |
| `app/api/health/route.ts` | Route Handler | `GET /api/health` for an uptime monitor: asks the database for `select 1` (`isDatabaseUp` in `lib/data.ts`) and answers 200 `{ status: "ok" }` or 503 `{ status: "down" }`, with `Cache-Control: no-store`. Public, so it says nothing else (no versions or error details) |
| `.github/workflows/ci.yml` | GitHub Actions | "Checks": on every push to `main` and every pull request, one job runs `npm run check`, another builds the app and runs the browser tests against the test database (`E2E_DATABASE_URL` secret; a random `BETTER_AUTH_SECRET` per run; placeholder Google settings, since tests sign in without Google). Failed browser runs keep the Playwright report for 7 days |
| `.github/dependabot.yml` | Dependabot | Weekly npm update pull requests (minor and patch grouped, majors one by one), monthly for GitHub Actions |
| `app/api/auth/[...all]/route.ts` | Route Handler | Hands every `/api/auth/*` request (sign in, Google callback, sign out) to Better Auth |
| `app/api/export/route.ts` | Route Handler | `GET /api/export`: checks the session (401 without one), then sends `toBookmarksHtml(links, folders)` as a download (`Content-Disposition: attachment`, `Cache-Control: no-store`). The account page links to it with a plain `<a download>` |
| `app/api/cron/check-links/route.ts` | Route Handler | Called daily by Vercel Cron. Checks the secret, then checks every user's links with `getLinksToCheck()` and saves each result for its owner |
| `components/SignInButton.tsx` | Client | Calls `authClient.signIn.social({ provider: "google", callbackURL })` on click. Takes `callbackURL` (default `/`), `label` and `className`, so the landing page can use it as "Sign in", "Sign in with Google" and "Start saving links" |
| `app/share/page.tsx` | Server | The save card for saving from anywhere. Reads `url`, `text` and `title` from `searchParams` (`findSharedUrl` takes the first http(s) link from `url`, then `text`). No link: says so. Signed out: `SignInButton` with `callbackURL={shareAddress(url, title)}`, so you come back to the same link. Signed in: `ShareForm`. Signed in, it also reads your folders for the form's folder menu |
| `components/ShareForm.tsx` | Client | Title and Tags boxes and **Save link**, which calls the existing `saveLink` action; then "Saved to Linkwell." or the action's error ("You already saved this link!"). A `FolderPicker` sits under Tags; until you pick, it offers the folder you saved to last on this device (`useLastFolder`, if that folder still exists), and after saving it says where ("Saved to Linkwell in Travel.") |
| `components/FolderPicker.tsx` | Client | The "Save to folder" menu: No folder, your folders, and **New folder…**, which swaps the menu for a name box (focused; Enter creates, Esc cancels), calls `onCreate` and picks the new folder, or shows why it couldn't. Also exports `useLastFolder()`, the last folder saved to on this device (`localStorage`, `useSyncExternalStore`) |
| `components/ImportBookmarks.tsx` | Client | Import on the account page. One `step` state (a union type): **choose** a file → **preview** ("Found N links in M folders") → **importing** (progress) → **finished** (added and skipped counts). Reads the file in the browser with `parseBookmarksHtml`, then calls `importBookmarks` once per batch of `IMPORT_BATCH_SIZE` (200). Refuses files over 10 MB |
| `components/Bookmarklet.tsx` | Client | The draggable "Save to Linkwell" link on the account page. Sets its `javascript:` address in a `useEffect` (`bookmarkletCode(window.location.origin)`), because React blocks `javascript:` URLs in JSX. Clicking it on the account page does nothing |
| `app/manifest.ts` | Metadata file | Served as `/manifest.webmanifest` and linked from every page by Next.js. Name, colours, icons, `display: "standalone"`, and `share_target` (GET `/share` with `title`, `text`, `url`) |
| `app/account/page.tsx` | Server | The account page. Reads the session; with none, `redirect("/")` sends the visitor to the sign-in screen. Shows the picture, name, email, join date and the `UsernameForm` |
| `components/LogoMark.tsx` | Server or client | Linkwell's chain link (the app icon's two loops) as a small ink line drawing in `currentColor`, `aria-hidden`; before the name in `Header`, `LegalPage` and the landing page's bar |
| `components/Header.tsx` | Server or client | The floating glass bar on every signed-in page: `LogoMark` and "Linkwell" (a link home), an optional middle part (`children`: the save box on the links page), and your `Avatar` and `@username` (or name) linking to `/account`, plus `SignOutButton`. With a middle part it's a rounded rectangle, and on phones the middle part wraps onto its own row. The account page uses it without one |
| `components/Avatar.tsx` | Server or client | The Google profile picture (`next/image`, `unoptimized`, `referrerPolicy="no-referrer"` because Google's image server can refuse requests that say where they came from), or the name's first letter |
| `components/DeleteAccount.tsx` | Client | "Delete my account…" opens a form; typing `delete` unlocks "Delete forever", which calls `authClient.deleteUser()`. On success it goes to `/?deleted=1` (the sign-in screen shows a goodbye message); on `SESSION_EXPIRED` it offers "Sign in again" |
| `components/UsernameForm.tsx` | Client | Calls `saveUsername`, shows the error or "Saved", then `router.refresh()` so the header shows the new username |
| `components/SignOutButton.tsx` | Client | Calls `authClient.signOut()`, then `router.refresh()` so the server page renders again and finds no session |
| `app/actions.ts` | Server Actions (`"use server"`) | Runs on the server; the browser calls its functions over the network |
| `components/LinkManager.tsx` | Client | Holds `useState` for links, folders, search text, sort order, the link shown in the details panel (`detailsId`) and whether the phone drawer is open (`menuOpen`); the chosen smart list (`SmartList`: all, unread, broken) or folder, the tag filter and the view come from the address (`useAddressState`, with `initialSearch` from the server). Calls the Server Actions. Draws the top bar (with the save box), the `Sidebar`, and the list column: Rediscover, a heading naming the current list with how many links it shows and, on phones, the **Lists** button (a folder's heading has `FolderActions` under it), search, sort and the view, and the cards (one column, two from `lg` unless the details panel takes the third column). A smart list and a folder are one choice; a tag combines with either |
| `components/ImportBanner.tsx` | Client | Reads old links from `localStorage` after the first render (`useEffect`), offers to import them |
| `components/CheckLinksButton.tsx` | Client | Calls `checkAllLinks`, shows "Checking..." while it runs and a summary when it's done |
| `components/Rediscover.tsx` | Client | A slim banner (a named `<section>`) above the list: the `Spyglass` drawing, "Remember this one?" and **one** of the links it's given (title, site, "saved 3 weeks ago"). **Show another** flips to the next, wrapping round (state: `turn`); on phones it's a round arrow button with the same name. `LinkManager` passes up to ten links (`pickRediscover(links, now, 10)`), oldest first |
| `components/illustrations/Spyglass.tsx` | Server or client | Rediscover's banner drawing, wide and short (`viewBox` 120×64): the character from the shoulders up, a spyglass pressed to the glasses, a bookmark shining in the corner. `Drawing` takes a `viewBox` for drawings like this |
| `components/illustrations/Character.tsx` | Server or client | The Linkwell character, drawn after Linkwell's creator, as reusable doodle parts placed with `x`/`y`: `Head` (curly hair, square glasses, moustache, stubble; `tilt`), `Tee` (neck and dark T-shirt with marker shading), `Legs` (stick legs, shoes and the shadow), `Limb`, `Hand`, `Shoe`, plus `Shaded` (paper, an offset marker grey, then the outline), `Shadow`, `Bubble` (a speech bubble whose tail points at the speaker), `Sparkle`, `Bookmark`, `Heart`, `ChainLink` and `Drawing` (the shared 160×120 `<svg>`, `aria-hidden`, with the pen-wobble filter; `useId` gives each drawing its own filter id). Named exports, an exception to "one component per file", because they're the parts of one drawing |
| `components/illustrations/Stargazer.tsx`, `EmptyBox.tsx`, `Magnifier.tsx`, `Wave.tsx`, `LinkDoctor.tsx` | Server or client | The scenes: Rediscover (a telescope on a tripod, a bookmark among the stars), no links yet (an empty box), no search results (a magnifying glass and a "?" bubble), sign-in (`<Wave />` says "Hi!"; `<Wave goodbye />` says "Bye!" after deleting an account), and the doctor on the landing page. Black, white and marker grey only; hidden from screen readers |
| `components/illustrations/CaughtUp.tsx`, `AllWell.tsx`, `EmptyFolder.tsx` | Server or client | The empty lists: nothing unread (sitting at a café table with tea, a tick in the speech bubble), no broken links (a thumbs-up next to a healthy chain link), an empty folder (held open, a moth flutters out). `LinkManager`'s `emptyState()` picks the drawing and the words together |
| `components/illustrations/SnappedChain.tsx` | Server or client | A chain link snapped in two, with sparks in the gap; sits in the red Broken badge |
| `components/illustrations/Checkmark.tsx` | Server or client | A hand-drawn tick (one pen stroke with a small loop and an overshooting tail); sits in green (`text-success`) in the Read label | |
| `components/FolderIcon.tsx` | Server or client | The 12 hand-drawn folder icons, as SVG paths on a 24×24 grid. Draws in `currentColor`, so `FOLDER_TEXT_CLASS` colours it |
| `components/Sidebar.tsx` | Client | The left column (a drawer, on phones): smart lists with counts (All links, Unread, Broken, from `countLinks`) and Check links; the folders (`FolderBar`, with counts); and the tags (`countTags`, most used first). Counts are `aria-hidden`, so buttons keep short names ("Work", not "Work 3"); the tag buttons are named by the tag alone, so they don't clash with the cards' "#tag" buttons. **On phones** (below `md`) it's hidden until the **Lists** button next to the list's heading opens it (`open`, `onClose` from `LinkManager`): it slides over a dimmed page, focus moves to its Close button, and Close, Esc, a tap on the page, or picking a list, folder or tag closes it, putting focus back on the Lists button. Tags: the 5 most used plus the chosen one, with **Show all N tags** / **Show fewer** (`allTags` state) |
| `components/FolderBar.tsx` | Client | The folders in the sidebar: one row each (icon or coloured dot, name, link count), selecting a folder (click again to leave it), and the "+ New folder" form with its own input and error state |
| `components/FolderActions.tsx` | Client | For the selected folder: the icon picker ("Dot" plus 12 icons, labelled "Coffee icon", ...), the colour picker (8 circles), the rename form and Delete (asks `window.confirm` first). Pickers use `aria-pressed` on the current choice |
| `components/LinkForm.tsx` | Client | The save box in the top bar: the link, Paste (where the browser can read the clipboard) and Save on one row; Title and Tags appear in a second row only while there's text in the link box. Holds input state, handles submit; only clears fields that still hold what was saved. The **Paste** button reads the clipboard (`navigator.clipboard.readText()`) and takes the link out with `findSharedUrl`; whether to show it comes from `useSyncExternalStore` (the server says `false`). The second row also has a `FolderPicker` ("Save to folder"), starting on the folder being looked at (`currentFolder`); `onAdd` gets the folder id too |
| `components/LinkCard.tsx` | Client | One link, as a card (Cards view) or, with `compact`, a row (List view). Both show the title and badges, then a quiet line: the site name, when it was saved and its folder (a dot and the name, from `folders`). Cards add the note as a sticky note, the archive link and tags. Actions: Mark read and Details always; Edit and Delete only while hovered or focused on devices with a mouse (`[@media(hover:hover)]`, `group-hover`), hidden on touch screens where the details panel has them. Read links' icons go grey. Edit mode (`isEditing`) shows `EditForm` in place |
| `components/LinkDetails.tsx` | Client | The details panel for one link (an `<aside>` named by the link's title): full address, badges, archive link, the whole note, saved / read / last-checked dates, a folder menu, tags, and Mark read, Edit (the edit form opens inside it) and Delete. A sticky third column from `lg`, a fixed full-screen sheet below. Moves focus to its heading when it opens; Close or Esc closes it |
| `components/LinkParts.tsx` | Client | Pieces the card, the row and the panel share: `Favicon` (small, medium, large), `Badges` (Read, Broken), `StickyNote`, and `EditForm` (title, tags and note, with its own draft state) |
| `components/useLinkView.ts` | Client hook | `useLinkView()`: the chosen view (`"cards"` or `"list"`) and a setter, kept in `localStorage` (`linkwell:view`) and read with `useSyncExternalStore` (the server renders cards). Storage that's blocked falls back to cards |
| `components/useAddressState.ts` | Client hook | `useAddressState(serverSearch)`: the list, folder, tag and view read from the address (`readAddress`, which falls back to defaults on anything odd), and `update(changes, { replace })`, which writes them with `history.pushState` (or `replaceState`), leaving defaults out so the plain address stays `/`. `useSyncExternalStore` follows `popstate`, so Back and Forward update the list |

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
| `color` | `text`, can be `null` | One of `FOLDER_COLORS` (migration `0010`). `null` = gray, for folders made before v1.6. `toFolder` ignores anything not in the palette |
| `icon` | `text`, can be `null` | One of `FOLDER_ICONS` (migration `0011`). `null` = show the coloured dot |
| `created_at` | `timestamp with time zone`, required, default `now()` | Folders are listed oldest first, so new ones appear at the end |

**The `rate_limits` table** (`db/schema.ts`, migration `0012`): how often each user used each rate-limited action in one time window.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `text`, foreign key → `user.id`, `ON DELETE CASCADE` | |
| `action` | `text` | A key of `RATE_LIMITS` in `lib/limits.ts` (`saveLink`, `checkLinks`, ...) |
| `window_start` | `timestamp with time zone` | The start of the window (`windowStart(now, seconds)`: each minute, each hour, ...) |
| `count` | `integer`, default `0` | Uses in that window |

The primary key is (`user_id`, `action`, `window_start`), so each window has one row. The daily cron job deletes rows older than a day.

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
| `insertLinks(userId, links)` | Saves many links in **one** `INSERT` (used by the bookmarks import), including their `folderId` |
| `updateFolderName(id, name)` | Renames a folder |
| `countAction(userId, action, windowStart)` | Adds 1 to that window's count (or starts it at 1) in one `INSERT ... ON CONFLICT DO UPDATE` and returns the new total. Used by `isTooFast` in `app/actions.ts` |
| `deleteOldRateLimits(before)` | Deletes rate limit rows from windows before that date (the cron job) |
| `updateFolderColor(userId, id, color)` / `updateFolderIcon(userId, id, icon)` | Change a folder's colour, or its icon (`null` = dot) |
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
| `setFolderColor(id, color)` / `setFolderIcon(id, icon)` | Save a folder's colour or icon. Anything outside `FOLDER_COLORS` / `FOLDER_ICONS` (or `null` for the icon) is ignored. `createFolder` and `importBookmarks` give new folders `nextFolderColor(number of folders)` |
| `deleteFolder(id)` | Deletes the folder; its links stay, without a folder |
| `importBookmarks(batch)` | Refuses more than `IMPORT_BATCH_SIZE` bookmarks. Runs each through `cleanBookmark` (http/https only, trimmed and cut texts, tags through `parseTags`, no future dates), skips links already saved or repeated in the batch (a `Set` of `normalizeUrl` addresses), finds each folder by name ignoring case or makes it, then saves everything with `insertLinks`. Returns `{ added, skipped }` |
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

**Three databases** (Neon branches), so development and tests never touch real data:

| Variable in `.env.local` | Neon branch | Used by |
|---|---|---|
| `DATABASE_URL` | `dev` | `npm run dev` and `drizzle-kit` on your laptop |
| `E2E_DATABASE_URL` | `e2e` | `npm run e2e` (the browser tests) |
| `PROD_DATABASE_URL` | `production` | Only for migrating the live database. The live site itself gets its `DATABASE_URL` from Vercel's settings |

Write these values without quotes, or the `grep ... | cut` commands below copy the quotes too.

**Changing the database:**

1. Edit `db/schema.ts`.
2. `npx drizzle-kit generate --name <what_changed>` writes a new numbered SQL file in `drizzle/`. Read it.
3. `npx drizzle-kit migrate` applies it to the `dev` branch (it prints nothing on success; check **Tables** in the Neon dashboard).
4. Apply it to the test branch: `DATABASE_URL="$(grep '^E2E_DATABASE_URL=' .env.local | cut -d= -f2-)" npx drizzle-kit migrate`, then run `npm run e2e`.
5. **Before pushing** code that needs it, apply it to the live database (migrate first, push second, every time): `DATABASE_URL="$(grep '^PROD_DATABASE_URL=' .env.local | cut -d= -f2-)" npx drizzle-kit migrate`. Only add things (new tables, new optional columns) in a way the old live code can live with, because the migration runs a minute or two before the new code is deployed. Pushing first breaks the live site: the new code asks for a column the live database doesn't have yet (this happened once with `note`).
6. Commit the schema change and the migration together.

Never edit a migration that has already been applied. Make a new one instead.

**Secrets:** `DATABASE_URL` lives only in `.env.local` (ignored by Git). It has no `NEXT_PUBLIC_` prefix, so Next.js never sends it to the browser. `drizzle.config.ts` loads it with `loadEnvConfig` from `@next/env`, because `drizzle-kit` runs outside Next.js. The auth settings live there too: `BETTER_AUTH_SECRET` (a random string, for example from `openssl rand -base64 32`, that signs session cookies; changing it signs everyone out), `BETTER_AUTH_URL` (the app's address, `http://localhost:3000` locally) and `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from Google Cloud Console. Google only sends users back to redirect URIs listed there, so `http://localhost:3000/api/auth/callback/google` must be one of them (and the deployed address, in v1.0). Restart `npm run dev` after changing `.env.local`.

## 6. Conventions

- **File names:** components use `PascalCase.tsx` (`LinkCard.tsx`). Everything else uses `camelCase.ts` (`links.ts`).
- **One component per file.** Use a default export named after the file.
- **Props types:** define `type <Component>Props` right above the component.
- **Imports:** use the `@/` alias (`@/types/link`), not long relative paths (`../../types/link`).
- **Type-only imports:** use `import type { ... }` for types.
- **Styling:** use Tailwind utility classes in the JSX. Avoid separate CSS files except `app/globals.css`.
- **Shared styles live in `app/globals.css` as `@utility` classes.** Use them instead of writing the classes again:

  | Class | For |
  |---|---|
  | `glass` | Every tile and card (quiet glass: almost white, bright top edge) |
  | `glass-bar` | Things that float above the page, like the sticky header (more see-through liquid glass) |
  | `field` | Every text input and menu |
  | `field-area` | Text boxes with several lines (the note): like `field`, with rounded corners instead of a pill |
  | `btn-primary` | The main action (Save, Sign in, Import): Apple blue `#0071e3` |
  | `btn-secondary` | A second action (Check links, Create, Rename, Show all): white pill |
  | `btn-quiet` | A way out (Cancel, Not now, Sign out): text only, grey on hover |
  | `btn-danger` | Actions that can't be undone (Delete my account): red outline and text |

  Add layout classes next to them (`className="field min-w-0 flex-1"`), but don't override what the shared class sets (colours, padding, corners), because which one wins isn't reliable. If a control needs a different look, add a new shared class.
- **Colours are tokens named by their job,** defined once in `app/globals.css` and switched for dark mode there. Use these, never a Tailwind shade like `text-slate-900` or `bg-white`, or that element won't change in dark mode:

  | Class | For | Light | Dark |
  |---|---|---|---|
  | `bg-canvas` | The page | `#f5f5f7` | black |
  | `bg-surface` | Inputs, buttons, pills | white | `#1c1c1e` |
  | `text-ink` | Main text | near-black | near-white |
  | `text-muted` | Secondary and small text | `#475569` | `#a1a1a6` |
  | `border-line` / `ring-line` | Borders and dividers | 10% black | 15% white |
  | `bg-hover` | A light wash (hover, tag chips) | 5% black | 8% white |
  | `text-accent` | Links | `#0066cc` | `#2997ff` |
  | `text-danger` | Errors, broken links | red | soft red |
  | `text-warning` | Archived copies | amber | light amber |
  | `text-highlight` | Rediscover | violet | light violet |
  | `text-success` | Mark read (hover) | green | light green |

  | `bg-folder-blue` ... `bg-folder-gray`, `text-folder-*`, `fill-folder-*` | Folder colours (8, Apple's system colours) | system colour | brighter dark-mode shade |

  Opacity works as usual (`bg-danger/15`). To add a colour: add a `--name` variable to both `:root` blocks and a `--color-name` line to `@theme inline`. No component uses `dark:` classes.
- **Fixed colours, on purpose:** the blue `btn-primary` (`#0071e3` works in both modes), and the favicon tile, which stays white like an app icon so dark logos stay visible.
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
- **Code that runs outside the app** (the bookmarklet and the extension) is run in the test with fakes: `bookmarkletCode(...)` is run with `new Function("location", "document", "window", body)` and a fake page, and `extension.test.ts` sets a fake `chrome` (`vi.stubGlobal`) before importing `extension/background.js`, then calls the click listener it registered.
- **Never copy values like storage keys or error messages from one module into another's code.** Import shared values, so a typo can't make a test pass for the wrong reason.

**Browser tests (Playwright, `npm run e2e`):**

- **Contrast:** `e2e/contrast.spec.ts` checks that every text on the page is readable (WCAG AA: 4.5:1, or 3:1 for large text). Glass is see-through, so the background can't be read from CSS: `measureContrast` in `e2e/contrast.ts` hides all text, takes a screenshot, and compares each text's colour with the typical (median) pixel behind it. The median ignores the few edge pixels in a text's box (a button's rounded corners show the page behind them), and it works for dark text on light and light text on dark. Faded parents (`opacity`) are counted too. The test runs twice, with the browser set to light and to dark mode (`test.use({ colorScheme })`). If it fails, it lists each text with its ratio.

- They cover what the fake-browser tests can't: the real server, the real database, sessions and cookies. Keep them few, one per important path (signed out, sign in and out, saving survives a reload, accounts are kept apart). Details belong in the Vitest tests.
- `playwright.config.ts` builds the app and starts it on port 3100, with `DATABASE_URL` set to `E2E_DATABASE_URL` (a Neon branch called `e2e`) and `BETTER_AUTH_URL` set to `http://localhost:3100`. The real database is never touched, and `npm run dev` on port 3000 can keep running.
- **Signing in without Google:** `e2e/fixtures.ts` makes a second Better Auth instance with the `testUtils` plugin, the same secret and the test database. Its `signIn(name)` fixture saves a brand-new user and puts a real, signed session cookie in the browser. The plugin lives only in the tests, never in `lib/auth.ts`.
- Each test signs in its own new user, and the users are deleted afterwards (their links and folders go with them through `ON DELETE CASCADE`). Tests can run in parallel and never see each other's data.
- Find elements the same way as in Vitest tests: by role, label or placeholder. Type a title when saving a link, so the server doesn't fetch the page.
- When you add a migration, apply it to the test branch too: `DATABASE_URL="$(grep '^E2E_DATABASE_URL=' .env.local | cut -d= -f2-)" npx drizzle-kit migrate`.
- **New tabs:** the bookmarklet test runs the link's real code in the page and waits for the new tab with `page.waitForEvent("popup")`.
- **Security headers:** one test collects every `securitypolicyviolation` event while it visits each page signed out and signed in, and fails on any blocked script, style or image. If a new feature loads something from another site, that test says so, and `lib/csp.ts` needs the new address.
- Vitest skips `e2e/` (`exclude` in `vitest.config.mts`), so `npm run check` stays fast and doesn't need the test database.

## 8. Security checklist

Go through this list for every new feature, before committing. Each line is something Linkwell got wrong once, or protects on purpose.

**Server Actions and routes** (they're public: anyone can call them with anything)
- [ ] Starts with `await getUserId()` (or a session check in a Route Handler), and passes that id to every `lib/data.ts` call
- [ ] Every `lib/data.ts` function filters by `user_id` (`ownLink`, `ownFolder`), for reads, updates and deletes
- [ ] Checks its input again on the server, whatever the browser checked: use the helpers in `lib/links.ts` (`cleanNewLink`, `cleanText`, `cleanTags`, `cleanFolderName`, `isWebAddress`). Text that isn't text becomes `""`, lists get a maximum size
- [ ] New limits go next to the others in `lib/links.ts` (lengths) or `lib/limits.ts` (counts), and the form uses the same number as `maxLength`
- [ ] Ids from the browser are never trusted to belong to the caller: `ownLink`/`ownFolder` decide
- [ ] Expensive work (fetching other websites, many rows) gets a rate limit in `RATE_LIMITS`, counted before the work starts
- [ ] Errors the user should see are **returned** as text; thrown errors are hidden in production

**Fetching other websites**
- [ ] Always through `safeFetch` (`lib/safeUrl.ts`), never plain `fetch`, so private addresses stay unreachable

**Showing data**
- [ ] Text from users or other websites is shown with React (`{text}`), never `dangerouslySetInnerHTML`; anything written into HTML by hand (like the bookmarks export) goes through `escapeHtml`
- [ ] Links in `href` come from saved, `http(s)`-only URLs

**The browser**
- [ ] Anything loaded from another site (images, scripts, fonts) is added to `lib/csp.ts` on purpose; the security-header browser test fails until it is
- [ ] No inline `<script>`; inline `<style>` tags need the nonce
- [ ] New pages render per request (they read the session, or call `connection()`), so their scripts get the nonce

**Privacy**
- [ ] If a feature stores something new about people, or sends data somewhere new, update `/privacy` (and `SITE.legalUpdated`)

**Data and secrets**
- [ ] New tables get a `user_id` with `ON DELETE CASCADE`, so deleting an account deletes everything
- [ ] Migrations are applied to production **before** pushing the code that needs them
- [ ] Secrets go in `.env.local` and Vercel only; never in code, commits or logs

**Dependencies**
- [ ] `npm audit` before adding a package, and after updating. Known and accepted: `braces` (through `eslint-config-next`), a denial-of-service bug with no fixed version yet that only reads our own lint patterns. `overrides` in `package.json` gives `drizzle-kit`'s old `@esbuild-kit` helper a safe `esbuild`

## 9. Decision log

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
| 2026-10-18 | Minimal Apple-style look: plain `#f5f5f7` background, the system font, pill-shaped buttons in Apple blue | Asked for a calm, minimal look. The system font is San Francisco on Apple devices, and it needs no download (the Geist font was removed) |
| 2026-10-18 | The gradient background with colour blobs was tried and dropped | It looked broken when scrolling and too busy. A plain background is calmer, and it's easier to make readable and to turn dark |
| 2026-10-18 | Two kinds of glass: quiet `glass` for tiles and cards, liquid `glass-bar` for the sticky header | Glass only looks like glass when something moves behind it. On a plain background that's the header, with the links scrolling underneath; the cards stay almost white so text is easy to read |
| 2026-10-18 | Shared styles as Tailwind v4 `@utility` classes (`glass`, `glass-bar`, `field`, `btn-primary`, `btn-secondary`, `btn-quiet`) in `globals.css`, written with `@apply` | The same long class lists were copied into many files, and some were missed. Now the look changes in one place, and dark mode only has to change these |
| 2026-10-18 | Small text is `text-slate-600` or darker; read cards fade with `opacity-75` instead of `opacity-60` | Measured on glass, `slate-400` was about 2.6:1 and a read card's title 4.03:1, both below the 4.5:1 WCAG AA needs |
| 2026-10-18 | Contrast is checked by a Playwright test that measures screenshot pixels, not by an accessibility library | Tools like axe can't work out the colour behind see-through glass. Measuring the real pixels works for glass, gradients and dark mode alike |
| 2026-10-18 | Dark mode follows the system setting (`prefers-color-scheme`), with no toggle in the app | That's how Apple apps behave, and it needs no saved preference. A toggle can come later if someone asks |
| 2026-10-18 | Colours became tokens named by their job (`ink`, `muted`, `surface`, `line`, `accent`, ...), switched in one `@media (prefers-color-scheme: dark)` block, instead of `dark:` classes on every element | About 40 colour classes in 13 files would have needed a `dark:` partner, and new code would forget some. Now a component can't be "light only" by accident, and the theme lives in one file |
| 2026-10-18 | Read cards no longer fade; they get a grey title and a "Read" label | Measured properly, faded text was 3.93:1 (light) and 4.02:1 (dark), below 4.5:1. The earlier `opacity-75` "pass" came from measuring against the darkest pixel, which was wrong for faded text |
| 2026-10-18 | The contrast test compares against the median background pixel, and runs in light and dark mode | The darkest pixel is only the worst case for dark text; on a dark page, light text needs the opposite. The median works both ways and ignores edge pixels |
| 2026-10-18 | Favicon tiles stay white in dark mode | Many logos (GitHub, Vercel, Next.js) are black and would vanish on a dark tile |
| 2026-10-18 | Roadmap after v1.1: v1.2 profile (picture, account page, username, export, delete), v1.3 fixes and safety, v1.4 easier saving, v1.5 notes and tags, then the social vision | Usernames and the account page are the groundwork for public profiles; saving and organising come after the basics are safe |
| 2026-10-18 | The username is a Better Auth `additionalFields` entry (`input: false`, `unique: true`) plus a `username` column in `db/auth-schema.ts` | It's part of the user, so it arrives with the session (`session.user.username`) without an extra query. `input: false` stops the sign-in API from setting it; only `saveUsername` can |
| 2026-10-18 | Usernames: stored lowercase, 3 to 20 of `a-z`, `0-9` and `_`, with reserved names (`account`, `admin`, `api`, ...) | They'll become addresses like `/@borhan`; lowercase avoids `@Borhan` and `@borhan` being two people, and reserved names can't clash with pages |
| 2026-10-18 | `saveUsername` checks `isUsernameTaken` first, and the database's `UNIQUE` constraint is the final guard | The check gives a friendly message; the constraint still stops two people who pick the same name at the same moment (that rare case shows an error page) |
| 2026-10-18 | A shared `Header` (Server Component) replaces the header that lived in `app/page.tsx`; the home page keeps a hidden `<h1>` (`sr-only`) | Two pages need the same bar now. Screen-reader users jump between headings, so every page still has an `<h1>` |
| 2026-10-18 | `LinkForm` only clears a field if it still holds what was saved | Saving can take seconds (the title is fetched), and clearing everything when it finished wiped a link you had started typing meanwhile |
| 2026-10-18 | The blue button gets darker on hover (`#0062c4`) instead of lighter (`#0077ed`) | Found by the contrast test on the account page: white on the lighter blue was 4.32:1, below 4.5:1 |
| 2026-10-18 | The contrast test skips disabled controls | WCAG doesn't require contrast for inactive controls, like the half-faded "Saving..." button |
| 2026-10-19 | Local development moved to its own Neon branch (`dev`); the production URL is kept as `PROD_DATABASE_URL`, only for migrations | Building "delete account" means pressing delete buttons while testing; on the shared database one mistake would delete real data. The app reads `DATABASE_URL` everywhere, so nothing in the code changed |
| 2026-10-19 | Export uses the Netscape bookmarks file format (HTML), with folders as `<H3>` + `<DL>` and tags in a `TAGS` attribute | Every browser and Raindrop can import it, so people can leave Linkwell with everything; v1.4's bookmark import reads the same format |
| 2026-10-19 | Titles, URLs, tags and folder names are escaped (`escapeHtml`) in the exported file | Titles come from other websites; a title like `<script>` must stay text, never become code in the file |
| 2026-10-19 | The export is a Route Handler (`GET /api/export`) linked with a plain `<a download>`, not a Server Action | A download is a file response with headers (`Content-Disposition`), which a normal address does well; it needs no JavaScript in the page |
| 2026-10-19 | Delete account uses Better Auth's built-in `deleteUser` (`user.deleteUser.enabled: true`), called from the browser | Better Auth removes the user, their sessions and the sign-in cookie; the database deletes their links and folders through `ON DELETE CASCADE`. No delete code of our own to get wrong |
| 2026-10-19 | Deleting only works within a day of signing in (Better Auth's `freshAge`); otherwise the app asks you to sign in again | Someone using a forgotten, signed-in laptop can't delete your account without signing in with Google first |
| 2026-10-19 | Confirmation by typing `delete` (trimmed, any capitals), not `window.confirm` | Typing a word is much harder to do by accident than pressing Enter on "OK"; sloppy spaces or capitals still count |
| 2026-10-19 | `btn-danger` is a red outline with red text, not a solid red button | White text on the dark-mode red (`#ff6961`) fails WCAG contrast; red text on the surface passes in both modes, and it's calmer |
| 2026-10-19 | After deleting, the browser goes to `/?deleted=1`, and the sign-in screen reads `searchParams` to say goodbye | The account no longer exists, so there's no session to carry a message; the address carries it instead |
| 2026-10-19 | v1.5 before v1.4 | Smaller and self-contained; the order of milestones is the user's call |
| 2026-10-19 | One Edit form for title, tags and note, saved by one Server Action (`saveLinkDetails`), replacing `saveTitle` | All three are "details about a link" and are edited together; one action means one request and one place for the rules. The old title-only code was deleted, not kept next to it |
| 2026-10-19 | The browser sends the raw text (`LinkDetailsInput`); the server cleans it with `cleanDetails` and returns the result (`LinkDetails`) | Never trust the browser. Tags go through the same `parseTags` as when saving, and the card shows what was really stored |
| 2026-10-19 | Notes are plain text, at most 500 characters (`NOTE_MAX_LENGTH`, cut on the server, `maxLength` in the form) | "Why I saved this" is short; a limit stops anyone from filling the database through the public Server Action |
| 2026-10-19 | Search also looks in notes | Notes are often the words you remember ("interview"), not the page title |
| 2026-10-19 | Browser tests match field names with `exact: true` | Playwright matches names partly by default, so "Title" also found the save form's "Title (optional)" box |
| 2026-10-19 | One `/share?url=...&title=...` page receives links from every saving tool (extension, bookmarklet, Android Share menu, iPhone Shortcut) | Saving rules live in one place (`saveLink`); each tool is only a few lines that open an address |
| 2026-10-19 | `/share` saves only after a click on **Save link**, never when the page opens | Any website can open `/share?url=...` in your browser; saving on load would let strangers add links to your account (a CSRF-style attack). The card also lets you fix the title and add tags |
| 2026-10-19 | `findSharedUrl` takes the first `http(s)://` link from `url`, then from `text` | Android apps often put the link inside `text` ("Watch this! https://..."). Only http and https count, so a `javascript:` link can't get in |
| 2026-10-19 | Signing in from `/share` passes `callbackURL` to Better Auth | Otherwise Google sends you to the home page and the shared link is lost |
| 2026-10-19 | The bookmarklet's address is built from `window.location.origin` | The same code works on localhost and on the live site; a bookmarklet dragged from one saves to that one |
| 2026-10-19 | The extension asks only for `activeTab` and opens `/share` in a new tab next to the page | `activeTab` shows it the current tab only when you click the button: no access to other tabs or history. Opening `/share` reuses the sign-in cookie and the save card, so the extension needs no login or API of its own |
| 2026-10-19 | The extension points at the live site (`LINKWELL` in `background.js`) and is loaded unpacked, not published | One person uses it for now; publishing on the Chrome Web Store waits for real users |
| 2026-10-19 | iPhone saving uses a Shortcut (and Add to Home Screen), not `share_target` | Safari doesn't support Web Share Target, so an installed web app can't appear in the iPhone Share menu. A Shortcut can, and needs no code. A native app would need Xcode and a $99/year Apple account |
| 2026-10-19 | The installable app has no service worker | Chrome no longer requires one to install an app or receive shares; offline support isn't needed for a link saver that talks to the server anyway |
| 2026-10-19 | A separate maskable icon (`icon-maskable-512.png`), a full square without rounded corners | Android cuts app icons into its own shape; an icon with its own rounded corners would get a white frame |
| 2026-10-20 | The Paste button fills in the link but doesn't save | You still see the link, and can add a title and tags, before saving; reading the clipboard should never change data on its own |
| 2026-10-20 | `useSyncExternalStore` decides whether to show Paste, not `useEffect` + `useState` | The linter refuses setting state inside an effect (an extra render). `useSyncExternalStore` reads a browser-only value, with a server answer (`false`) so hydration matches |
| 2026-10-20 | Bookmarks files are read in the browser (`DOMParser`), not uploaded | The browser already has an HTML reader; only the links travel to the server, never a whole file, so there's no upload size or file storage to handle |
| 2026-10-20 | Folders in a file are found by position: the `<H3>` right before the `<DL>` around a link. The browser's own folders (`PERSONAL_TOOLBAR_FOLDER`, `UNFILED_BOOKMARKS_FOLDER`) are skipped. Nested folders keep only the innermost name | Linkwell folders are flat (one level), and a "Bookmarks bar" folder holding everything would be useless |
| 2026-10-20 | The import is sent in batches of 200 (`IMPORT_BATCH_SIZE`), one after another, and the server refuses bigger batches | A Server Action accepts about 1 MB per request. Batches also give a progress count, and a failed batch loses nothing: trying again skips what was saved |
| 2026-10-20 | `cleanBookmark` checks every imported field again on the server | `importBookmarks` is a public address like every Server Action; the browser's parsing proves nothing |
| 2026-10-20 | The import screen is one `step` state with a union type, not several booleans | The screen is always in exactly one state, and each state carries only its own data, so impossible mixes (importing and finished at once) can't happen |
| 2026-10-20 | Sharing the iPhone Shortcut as an iCloud link moved to "later" | Only useful once other people use Linkwell; the Paste button already makes iPhone saving easy |
| 2026-10-20 | Folder colours are 8 named colours (Apple's system colours), stored by name (`"green"`), not as hex codes | Names keep every colour readable in light and dark mode (each has two shades in `globals.css`); a free hex picker would allow colours that vanish on one of them |
| 2026-10-20 | Each colour's class is written out in full (`FOLDER_DOT_CLASS`, `FOLDER_TEXT_CLASS`) | Tailwind only builds classes it can find in the code; `"bg-folder-" + color` would produce no CSS |
| 2026-10-20 | `setFolderColor` and `setFolderIcon` accept only palette names | They're public Server Actions, and the value ends up in a class name and decides which drawing to show |
| 2026-10-20 | New folders get the next palette colour; folders from before v1.6 are gray (`null`) | Colourful without anyone choosing; old folders didn't need a data migration, only a new column |
| 2026-10-20 | The 📁 emoji is gone, from the pills and the card's folder menu | The coloured dot or icon replaces it; menu options can't show a coloured dot, so they show the name only |
| 2026-10-20 | Folder icons are our own SVG drawings in code (`FolderIcon.tsx`), not an icon library or image files | They match the hand-drawn style, take the folder colour through `currentColor`, cost no download, and are ours to use |
| 2026-10-20 | The "work" icon became "briefcase", and icon buttons are labelled "Coffee icon", ... | A folder named "Work" and an icon button named "Work" were two buttons with the same name, which screen readers (and the tests) can't tell apart |
| 2026-10-20 | Illustrations are decoration (`aria-hidden`), and Rediscover's is hidden on phones | The words already say everything; on a narrow screen the drawing squeezed link titles to a few letters |
| 2026-10-20 | Illustrations are black-and-white line-art portraits, after three tries (a round blob, a colourful night scene, a faceless figure) | Asked for minimal character vectors in black and white, from a reference image: bold even outlines, black hair, faces with personality |
| 2026-10-20 | One Linkwell character, drawn after Linkwell's creator, built from shared parts in `Character.tsx` | It's their project; one recurring character gives the app a face, and shared parts keep every scene consistent (change the glasses once, every drawing follows) |
| 2026-10-20 | Plan: v1.7 security, v1.8 landing page, v1.9 "runs on its own" (in that order) | Lock the doors before inviting strangers; then make Linkwell safe to leave alone (two-factor accounts, automatic tests and updates, monitoring, backups, a maintenance guide) |
| 2026-10-20 | No Docker | Vercel runs the app and Neon runs the database, so there's no server of our own to package. Docker only becomes useful if Linkwell moves to self-hosting |
| 2026-10-20 | Input limits live once in `lib/links.ts` (`URL_MAX_LENGTH` 2048, `TITLE_MAX_LENGTH` 500, `NOTE_MAX_LENGTH` 500, `TAG_MAX_LENGTH` 50, `TAGS_MAX` 20, `FOLDER_NAME_MAX_LENGTH` 100), enforced by the server and used as `maxLength` in the forms | One source for the rules: the server is the guard (Server Actions are public), the forms only show the limit while typing |
| 2026-10-20 | Every action cleans its input with shared helpers (`cleanNewLink`, `cleanDetails`, `cleanBookmark`, `cleanFolderName`, built on `textOf`, `cleanText`, `cleanTags`, `cleanDate`, `isWebAddress`) | The same rules everywhere, and input that isn't text (a number, an object, `null`) becomes "" instead of crashing the action |
| 2026-10-20 | Only `http` and `https` links can be saved | `javascript:` links run code when clicked, and `data:`/`file:` links aren't web pages. React already refuses to render `javascript:` links, but the database shouldn't hold them either (the export would carry them on) |
| 2026-10-20 | `saveLink` keeps only `id`, `url`, `title`, `tags` and `createdAt` from the browser, and replaces an id that isn't a real UUID | A new link can't arrive already "read", "ok" or in some folder; a strange id would otherwise make the database query fail |
| 2026-10-20 | Rate limits are counted in Postgres (`rate_limits`), not in memory or a new service | On Vercel each request may run on a different machine, so memory forgets; Postgres is already there, one query per check, and the database does the counting, so two requests at once can't both slip through |
| 2026-10-20 | Fixed windows (this minute, this hour) instead of a sliding window | Simple, one row per window, easy to test; someone could squeeze in twice the limit across a window's edge, which is fine for these limits |
| 2026-10-20 | Only the expensive actions are rate limited: saving (fetches the title), "Check links" (fetches every link) and the imports | They make the server visit other websites or write many rows; cheap actions (edit, delete, mark read) only touch the user's own rows |
| 2026-10-20 | Every call counts toward a rate limit, even ones that fail | Otherwise someone could send endless invalid requests for free |
| 2026-10-20 | At most 10,000 links and 200 folders per account (`MAX_LINKS`, `MAX_FOLDERS`) | Far more than a person needs, small enough that one account can't fill the free database plan |
| 2026-10-20 | Limit messages come back as text (`TOO_FAST`, `TOO_MANY_LINKS`, ...) instead of thrown errors | In production, Next.js hides a thrown error's message from the browser; a returned message can be shown as it is |
| 2026-10-20 | A Content-Security-Policy with a nonce, set in `proxy.ts`, instead of a fixed policy with `'unsafe-inline'` in `next.config.ts` | With `'unsafe-inline'` any injected `<script>` would still run; a fresh nonce per page means only Next.js's own scripts run. The cost (every page rendered per request) is free here: Linkwell's pages already are, because they read the session |
| 2026-10-20 | `style-src-attr 'unsafe-inline'`, while `<style>` tags need the nonce | `Avatar` and `next/image` set `style=""` attributes, which a nonce can't cover; injected style attributes can't run code |
| 2026-10-20 | In development, styles use `'unsafe-inline'` instead of the nonce, and scripts may `eval` | The dev server injects CSS without a nonce, and React's dev error stacks use `eval`; production keeps the strict policy |
| 2026-10-20 | `img-src` allows Google's favicon service (`www.google.com`, `*.gstatic.com`) and profile pictures (`*.googleusercontent.com`) | Those are the only outside images; everything else must come from Linkwell itself |
| 2026-10-20 | No `upgrade-insecure-requests` | The browser tests run on `http://localhost`, where it would break every request; on the live site, HTTPS is already enforced by `Strict-Transport-Security` and Vercel |
| 2026-10-20 | The contrast test uses Playwright's `bypassCSP` | It injects a `<style>` tag to hide text while measuring, which the policy (rightly) blocks; a separate test checks that real pages cause no violations |
| 2026-10-20 | `npm audit fix` for `vite`; an `overrides` entry for `@esbuild-kit/core-utils`' `esbuild` instead of `npm audit fix --force` | `--force` would have downgraded `drizzle-kit` by a year. The override only replaces one old copy of esbuild inside a deprecated helper; `drizzle-kit generate` and `check` still work |
| 2026-10-20 | The `braces` advisory (through `eslint-config-next`) is accepted for now | No fixed version exists; it's a denial-of-service through crafted glob patterns, and it only reads our own lint config. `npm audit` will show the fix when it's released |
| 2026-10-20 | Security problems are reported through GitHub's private vulnerability reporting (`SECURITY.md`) | Reports stay private until fixed, and no email address has to be public |
| 2026-10-20 | The landing page replaces the sign-in card at `/` for signed-out visitors, instead of living at its own address | Visitors type the main address; signed-in people still land straight in their links. A separate page can come with the privacy and terms pages |
| 2026-10-20 | The landing page's three sign-in buttons have different labels ("Sign in", "Sign in with Google", "Start saving links") | Buttons with the same name are confusing in a screen reader's list of buttons, and tests can find each one by name |
| 2026-10-20 | The FAQ uses `<details>` and `<summary>` | Opens and closes with no JavaScript, works with the keyboard and screen readers out of the box |
| 2026-10-20 | No other companies' or products' names in what users see ("your browser", "your phone", "other bookmark apps") | Linkwell stands on its own instead of advertising or comparing itself to other brands. Internal docs may still name the tools Linkwell is built on |
| 2026-10-20 | The privacy page says "a hosting provider" and "a database provider" instead of their names; only the Google account is named | Keeps the no-brand-names rule while staying honest about who is involved; where account details come from has to be named, and the sign-in provider requires it |
| 2026-10-20 | The contact address lives in `SITE.contactEmail` and only shows once filled in | A privacy policy needs a way to reach someone, but publishing an email address is the owner's choice; until then, the pages point to the account page, where everything can be exported or deleted |
| 2026-10-20 | Static pages call `connection()` | With a nonce-based Content-Security-Policy, a page rendered at build time has no nonce, so its scripts would be blocked |
| 2026-10-20 | The sharing preview is a fixed PNG, designed as a page and screenshotted, instead of generated with `ImageResponse` | It never changes, so it costs nothing to serve, and the drawing uses the app's own CSS classes, which the image generator doesn't understand. To change it: render the design at 1200×630 and screenshot it again |
| 2026-10-20 | `SITE.url` holds the live address for `metadataBase` | Sharing previews need full URLs, and chat apps only ever see the live site |
| 2026-10-20 | v1.9 becomes "A better layout" (top bar, sidebar, Cards and List views, a details panel), and "Runs on its own" moves to v2.0 | The dashboard tiles get in the way as links grow; the landing page's screenshots wait for the new layout so they don't go out of date at once |
| 2026-10-20 | `LinkManager` draws the top bar on the links page (passing the save box into `Header` as `children`), instead of `app/page.tsx` | The save box is part of `LinkManager`'s state (it adds to the list); `Header` stays shared with the account page. `user` is optional, so tests can render the list without a bar |
| 2026-10-20 | Title and Tags only show while the link box has text | Most links are saved with just the address (the title is fetched), so the bar stays a slim pill; the details are one keystroke away |
| 2026-10-20 | A sidebar (smart lists, folders, tags) replaces the Overview tile, the notebook tabs and the tag strip | One place to choose what the list shows, with counts that are also filters; it doesn't scroll away as the list grows |
| 2026-10-20 | Choosing a smart list leaves the folder, and the other way round; tags combine with either | Like mailboxes and labels: you look at one place at a time, then narrow it down |
| 2026-10-20 | Two card columns next to the sidebar, not three | With the sidebar beside them, three columns cut titles down to a few words |
| 2026-10-20 | The cards list is named "Links" (`aria-label`) | Screen readers can jump to it, and tests count cards in it instead of every list item on the page |
| 2026-10-20 | List view is a `compact` mode of `LinkCard`, not a second component | Edit, Mark read, tags and badges behave the same in both views and live in one place |
| 2026-10-20 | The chosen view is remembered per device (`localStorage`), not per account | A phone and a big screen often want different views; it needs no database column |
| 2026-10-20 | List rows leave out the note, the folder menu and the archive link | A row is for scanning; the details panel (v1.9 step 4) shows everything about one link |
| 2026-10-20 | One details panel that's a column on wide screens and a full-screen sheet below `lg`, from the same markup | No second component for phones; CSS decides (`fixed inset-0` by default, `lg:sticky` beside the list) |
| 2026-10-20 | A "Details" button opens the panel; clicking the title still opens the website | People expect a link's title to take them to the page; a separate button is clear for keyboards and screen readers too |
| 2026-10-20 | The panel moves focus to its heading and closes on Esc | Keyboard and screen-reader users learn that something opened, and can leave it the usual way |
| 2026-10-20 | `Favicon`, `Badges`, `StickyNote` and `EditForm` moved to `LinkParts.tsx` | Three places show a link now (card, row, panel); one copy of each piece keeps them identical |
| 2026-10-20 | `fetchTitle` asks video sites' oEmbed service first, prefers `og:title` over `<title>`, and drops titles that are only " - Site name" | Big sites send a cut-down page to servers in data centres (titled just " - YouTube"), so production saved useless titles while local saves worked; oEmbed still answers, and a page can name its own oEmbed address as a fallback |
| 2026-10-20 | Every empty list gets its own drawing, chosen together with its words (`emptyState()`) | An empty Unread or Broken list is good news, not a failed search; the magnifying glass stays for searches only |
| 2026-10-20 | A logo mark in ink line art, not the blue app icon, in the top bar | It matches the drawings' black-and-white style and swaps in dark mode with `currentColor`; the blue icon stays for tabs and the Home Screen |
| 2026-10-20 | `ChainLink` becomes a shared drawing part | The doctor, the thumbs-up scene and the logo all show the same link as the app icon |
| 2026-10-20 | The drawings become loose pen doodles (full-body, stick limbs, grey marker, speech bubbles) instead of bold vector portraits | Asked for: more natural and hand-made, like notebook sketches. One kit of parts keeps the character the same person in every scene |
| 2026-10-20 | The hand wobble is an SVG filter on the whole drawing, not hand-jittered paths | Every line gets it for free, including new scenes; the paths stay readable. Each `<svg>` has its own filter id (`useId`), so a hidden drawing never breaks another's filter |
| 2026-10-20 | Two marker greys as colour tokens (`--marker`, `--marker-strong`) | The shading swaps in dark mode like every other colour, with no extra code in the drawings |
| 2026-10-20 | Rediscover shows one link at a time with "Show another", instead of a box of three | A slim banner stays front and centre without pushing the list down; one link is easier to act on than a list |
| 2026-10-20 | On phones the sidebar is a drawer behind a **Lists** button, from the same markup | The links come first instead of after every folder and tag; CSS (`max-md:hidden`, `max-md:fixed`) decides, so there's no second menu component |
| 2026-10-20 | Picking something in the drawer closes it | On a phone you open the menu to go somewhere; leaving it open would cover the list you just chose |
| 2026-10-20 | Cards show the site name, the date and the folder on one line; the full address and the folder menu moved to the details panel | A card is for recognising a link at a glance; the panel is for everything about it |
| 2026-10-20 | Edit and Delete on a card only show while it's hovered (with a mouse) and are left out on touch screens | Two buttons instead of four keep the grid calm; Details always has all of them, and keyboard focus shows them too |
| 2026-10-20 | The contrast check skips fully see-through text (`opacity: 0`) | Hidden-until-hover buttons aren't showing yet; when they show, they have the same style as the measured buttons next to them |
| 2026-10-20 | The chosen list, folder, tag and view live in the address, through `history.pushState` and `useSyncExternalStore`, instead of `useState` | Back, refresh and bookmarks keep your place. Next.js keeps its router in step with the browser's own `pushState`, and the hook also works in unit tests without a router |
| 2026-10-20 | Search stays out of the address | It changes with every key typed; a history entry per letter would make Back useless |
| 2026-10-20 | The sidebar shows 5 tags (plus the chosen one) until "Show all" | Tags grow without limit; the most used ones are what people pick |
| 2026-10-20 | Saving can pick a folder (and make one) on the save page and in the save box | Like a browser's bookmark star: a link usually has a home when you save it, and moving it afterwards is an extra step |
| 2026-10-20 | `saveLink` keeps a `folderId` only if it's one of the user's folders | Never trust the browser: someone could send another person's folder id; it then saves with no folder, as `moveToFolder` does |
| 2026-10-20 | The share page remembers the last folder per device; the save box starts on the folder being looked at | Saving from other pages often comes in runs into one folder; inside the app, the open folder says where you are |
| 2026-10-20 | The landing page's screenshots are taken by a Playwright script, not by hand | They stay exact and can be redone in a minute when the app changes; sample links use example addresses and made-up titles, so no real brands or personal data appear |
| 2026-10-20 | A light and a dark screenshot, swapped with CSS | The pictures match the page around them; a hidden `<img>` isn't loaded, so visitors download only one |
| 2026-10-20 | Small screens show the phone screenshot instead of the computer one | A computer screenshot shrunk to a phone's width is too small to read |
| 2026-10-20 | GitHub Actions runs the same `npm run check` and `npm run e2e` as on your computer | One definition of "it works"; a ✅ or ❌ next to every commit and pull request |
| 2026-10-20 | CI's browser tests use the test database and a throwaway sign-in secret made per run | The only stored secret is the test database's address; production secrets never leave Vercel |
| 2026-10-20 | `npm run check` runs `next typegen` first | `PageProps` and friends are generated into `.next/`, which isn't in Git; a fresh copy (CI, a new computer) failed the type check without them, and stale types caused errors before |
| 2026-10-20 | Dependabot groups minor and patch updates, majors come one by one | Fewer pull requests to look at; a major update (like a new Next.js) can need code changes and deserves its own |
| 2026-10-20 | The health check also checks the database, not just that the server answers | Most real outages would be the database (a paused Neon project, a wrong `DATABASE_URL`); a page that loads but can't show links is down too |
