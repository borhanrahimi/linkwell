# Architecture

This document explains how Linkwell's code is organized, how data moves through it, and the rules for adding new code. Update it whenever one of those changes.

## 1. Folder layout

Linkwell follows the "store project files outside of `app`" layout from the Next.js docs. `app/` is only for routing. Everything else lives in shared top-level folders.

| Folder | Holds | Rule of thumb |
|---|---|---|
| `app/` | Pages, layouts, route handlers | If it isn't tied to a URL, it doesn't belong here |
| `components/` | React components | Only UI. Gets data through props, reports user actions through callback props |
| `lib/` | Plain TypeScript functions | No JSX and no React. Easy to test on its own |
| `types/` | Shared type definitions | Only types, no runtime code |
| `__tests__/` | Automated tests | One test file per module or page (`links.test.ts`, `page.test.tsx`) |
| `docs/` | Project documentation | |

## 2. Layers

The code is split into layers. Each layer may only use the layers **below** it:

```
 ┌──────────────────────────────┐
 │  app/        (pages)         │  owns state, wires everything together
 ├──────────────────────────────┤
 │  components/ (UI)            │  displays data, emits events
 ├──────────────────────────────┤
 │  lib/        (logic & data)  │  creates, validates, stores links
 ├──────────────────────────────┤
 │  types/      (shapes)        │  describes what a Link is
 └──────────────────────────────┘
```

- ✅ `app/page.tsx` imports from `components/`, `lib/`, `types/`
- ✅ `components/LinkCard.tsx` imports from `types/`
- ❌ `lib/` must never import from `components/` or `app/`
- ❌ `types/` imports nothing

Why: when dependencies only point downward, you can change the UI without touching the logic. You can also swap where data is stored (memory → localStorage → database) without touching the UI.

## 3. Data flow

**Data flows down, events flow up.**

```
       localStorage ◀──── saveLinks(updated) ─────────┐
            │                                         │
  loadLinks() on first render (useEffect)             │
            ▼                                         │
         page.tsx                                     │
   state: links: Link[]                               │
      ┌─────┴───────────────┐                         │
      │ props: onAdd        │ props: link, onDelete,  │
      │                     │        onEditTitle      │
      ▼                     ▼                         │
  LinkForm             LinkCard × N                   │
      │                     │                         │
 onAdd(url, title,     onDelete(id)                   │
       tags)           onEditTitle(id, title)         │
      │                     │                         │
      └──────────┐ ┌────────┘                         │
                 ▼ ▼                                  │
         page.tsx computes `updated` list ────────────┤
                 │                                    │
                 ▼                                    │
         setLinks(updated) → React re-renders         │
```

1. `page.tsx` owns the list of links (the **single source of truth** while the page is open).
2. When the page opens, it loads saved links from storage once.
3. It passes data and callback functions down to children as props.
4. Children never change the list directly. They call the callback.
5. The page computes the new list once, then hands that same value to both `setLinks` (screen) and `saveLinks` (storage).

**When a child needs an answer back:** `onAdd(url, title, tags)` returns `null` when the link was saved, or an error message (a string) when it wasn't, for example a duplicate. The page decides (it owns the list), and the form shows the message and keeps the input so the user can fix it (it owns the inputs). Use this pattern when the parent has to accept or reject what a child sends up.

**Raw text up, clean data in `lib/`:** the form sends tags exactly as typed (`"React, news"`). The page turns them into a list with `parseTags` before calling `createLink`. The form only deals with what the user typed, and the rules for what a tag is live in one testable function.

**Derived state: store the facts, compute the rest:** the page stores three things in state: `links` (every link), `activeTag` (the tag the user clicked, or `null`) and `query` (the text in the search box). The list on screen, `visibleLinks`, is a plain `const` computed from them on every render: `searchLinks(filterByTag(links, activeTag), query)`. Each filter takes a list and returns a smaller one, so they chain: first the tag, then the search inside it. It is never stored with `useState`, so it can't fall out of sync with `links`. Adding, deleting and editing still work on the full `links` list, and the "No links yet" message checks `links`, not `visibleLinks`. When there are links but the filters hide all of them, the page shows "No links match your search." instead. A tag pill doesn't know what filtering is: it calls `onTagClick(tag)`, and the page passes `setActiveTag` straight in.

**Where state lives:** keep state in the lowest component that needs it. The text typed in the form and its error message only matter to `LinkForm`, so `LinkForm` owns them. The list of links is needed by both the form (adding) and the cards (deleting, editing), so it lives in their shared parent, `page.tsx`. Whether a card is in edit mode (`isEditing`) and the text being typed (`draft`) only matter to that one card, so each `LinkCard` owns them. The page only hears about an edit when the user presses Save. Cancel just throws the draft away.

## 4. Server vs. client components

In the Next.js App Router, components are **Server Components by default**. Add `"use client"` at the top of a file only when it needs:

- state or effects (`useState`, `useEffect`)
- event handlers (`onClick`, `onSubmit`)
- browser APIs (`localStorage`, `window`)

Anything a client component imports becomes client code as well, so you don't need `"use client"` in every file.

| File | Type | Why |
|---|---|---|
| `app/page.tsx` | Client | Holds `useState` for links, loads from `localStorage` in `useEffect` |
| `components/LinkForm.tsx` | Client | Holds input state, handles submit |
| `components/LinkCard.tsx` | Client | Holds edit-mode state (`isEditing`, `draft`), handles Edit/Save/Cancel |

**Goal:** keep `"use client"` as low in the tree as possible. Once links are stored on a server (see the roadmap), `page.tsx` can become a Server Component that loads data, with only the interactive parts as client components.

## 5. Data storage

Storage will change over time, so all reading and writing of links goes through **one module in `lib/`**. Components and pages never call `localStorage` or a database directly.

| Stage | Where links live | Survives refresh? |
|---|---|---|
| v0.1 | React state in memory | ❌ |
| **v0.2 (now)** | Browser `localStorage`, key `linkwell:links` | ✅ (this browser only) |
| v0.5 | Database on the server | ✅ (any device) |

Each time the storage changes, only the `lib/` module should need to change.

**Today that module is `lib/links.ts`:**

| Function | Job |
|---|---|
| `createLink(url, title?, tags?)` | Builds a new `Link`. Trims the title, and turns a blank title into `undefined`. `tags` defaults to `[]` |
| `filterByTag(links, tag)` | Links whose `tags` include `tag`. Returns the list unchanged when `tag` is `null`. Links saved before tags existed (no `tags` field) never match |
| `searchLinks(links, query)` | Links whose URL or title contains `query`, ignoring case and surrounding spaces. Returns the list unchanged when `query` is blank. Links without a title are matched by URL only |
| `getDomain(url)` | `https://www.example.com/page` → `example.com`. Returns the text unchanged if it isn't a valid URL |
| `getFaviconUrl(url)` | Address of the site's icon from Google's favicon service (`?domain=…&sz=32`). Returns `null` if it isn't a valid URL, and the card then shows no icon |
| `isDuplicate(links, url)` | `true` if the URL is already in the list. Compares normalized URLs (via `new URL().href`), so `https://EXAMPLE.com` matches `https://example.com/` |
| `parseTags(text)` | `"React, news,,react "` → `["react", "news"]`. Splits on commas, trims, lowercases, drops empty tags and duplicates (first one wins) |
| `loadLinks()` | Reads and parses saved links. Returns `[]` if nothing is saved or the data is broken |
| `saveLinks(links)` | Writes the whole list as JSON |
| `timeAgo(iso, now?)` | `"just now"`, `"5 minutes ago"`, `"yesterday"`, `"3 weeks ago"`, `"last year"`… Uses the biggest unit that fits and rounds down. `now` defaults to the current time; tests pass a fixed date |
| `updateTitle(links, id, title)` | Returns a **new** list where the matching link has the new title (trimmed; blank → `undefined`). Other links are returned unchanged, and the original list is never modified |
| `STORAGE_KEY` | The storage key, exported so tests use the exact same value |

**Rules for storage:**

- **Load once, after the first render, in `useEffect`.** Next.js renders pages on the server first, where `localStorage` doesn't exist, so it can't be read during render or in `useState(...)`.
- **Save inside the event handlers** (`addLink`, `deleteLink`, `editTitle`), **not in an effect** that watches `links`. Such an effect would run with the empty starting list before loading finishes, and could wipe saved links.
- The load effect needs `// eslint-disable-next-line react-hooks/set-state-in-effect`. The extra render it warns about is harmless here, and the code is temporary until v0.5. Any other lint disable needs a comment explaining why.

## 6. Conventions

- **File names:** components use `PascalCase.tsx` (`LinkCard.tsx`). Everything else uses `camelCase.ts` (`links.ts`).
- **One component per file.** Use a default export named after the file.
- **Props types:** define `type <Component>Props` right above the component.
- **Imports:** use the `@/` alias (`@/types/link`), not long relative paths (`../../types/link`).
- **Type-only imports:** use `import type { ... }` for types.
- **Styling:** use Tailwind utility classes in the JSX. Avoid separate CSS files except `app/globals.css`.
- **IDs and dates:** link IDs come from `crypto.randomUUID()`. Dates are stored as ISO strings (`toISOString()`) and formatted only for display. The card shows a relative date (`timeAgo`) inside `<time dateTime={iso}>`, with the exact date (`toLocaleDateString()`) as a hover tooltip.
- **Optional fields:** new fields on `Link` are optional (`title?: string`), because links saved earlier don't have them. Show a fallback when they're missing (`link.title || getDomain(link.url)`), or check before using them (`link.tags && link.tags.length > 0`).
- **Never change state in place.** Functions like `updateTitle` build a new array (`map`) and new objects (`{ ...link, title }`). React only re-renders when it gets a new value.
- **Images:** use `<Image>` from `next/image` with `width` and `height`. For tiny remote images like favicons (under 1 KB), add `unoptimized`: there's nothing to gain from resizing them, and it means we don't need `remotePatterns` in `next.config.ts`.
- **Accessible names:** every input needs a name: a visible `<label>`, a `placeholder`, or `aria-label` when there's no visible label (the edit box uses `aria-label="Title"`). Lists without a heading get `aria-label` too (the tag list uses `aria-label="Tags"`). Decorative images, like favicons next to a title that already names the site, get `alt=""` so screen readers skip them.
- **Parsing URLs:** use `new URL(...)` inside `try/catch` and fall back to the original text. Old saved data may not be a valid URL, and that must never crash the page.
- **Auto-imports:** check the imports at the top of a file after accepting an autocomplete suggestion. VS Code has added `import { get } from "http"` and `import { title } from "process"` by mistake.

## 7. Testing

Tests use **Vitest** with **React Testing Library**, running in `jsdom` (a fake browser).

- **`lib/` functions** get unit tests: call the function, check the result.
- **Pages and components** get tests that act like a user: type into inputs and click buttons, found by role, label or placeholder, never by CSS class. If a test can't find an element by role and name, a screen reader probably can't either. Fix the markup, not the test.
- **Old saved data:** when a new field is added to `Link`, add a test that saves an old-style link with `saveLinks` (without the field) and checks the page still shows it.
- **Searching inside one element:** use `within(element)` when the same role appears elsewhere on the page (a tag `listitem` sits inside a card `listitem`).
- **Several matching elements:** `getByRole` fails when more than one element matches (two cards with a `#docs` tag). Use `getAllByRole(...)[0]` when any of them will do.
- **Search box:** an `<input type="search">` has the role `searchbox`; find it with `getByRole("searchbox", { name: "Search links" })`.
- **Decorative images** (`alt=""`) are hidden from role queries on purpose, so tests find them with `document.querySelector("img")`.
- Every new feature comes with tests. Every bug fix gets a test that would have caught the bug.
- `npm run check` (types + lint + tests) must pass before committing.
- **Write the test first** when you can: watch it fail (🔴), then write the code (🟢). A test that never failed hasn't proven anything.
- **Time-dependent functions take `now` as a parameter** (with a default), so tests pass a fixed date and give the same result every day. Don't read the clock inside logic you want to test.
- **Never copy values like storage keys into tests.** Import them (`STORAGE_KEY`), so a typo can't make a test pass for the wrong reason.
- **Storage in tests:** clear `localStorage` in `afterEach`, so saved links can't leak into the next test.
- **Simulating a page refresh:** call `cleanup()`, then `render(<Home />)` again. React state is gone, and only `localStorage` survives.

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
| 2026-10-06 | One active tag at a time, cleared with "Show all" | Simplest filter that's useful; combining tags can come later if needed |
| 2026-10-06 | Search matches URL and title only (not tags), as you type, with a plain `includes` | Tags already have their own filter; `includes` is simple and fast enough for a personal list. No search button or debounce needed |
| 2026-10-06 | Search runs inside the active tag filter (`searchLinks(filterByTag(...))`) | Filters combine instead of replacing each other, which is what users expect |
