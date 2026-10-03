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
       localStorage ◀──── saveLinks(updated) ─────┐
            │                                     │
  loadLinks() on first render (useEffect)         │
            ▼                                     │
         page.tsx                                 │
   state: links: Link[]                           │
      ┌─────────┴──────────┐                      │
 props│onAdd         props │link, onDelete        │
      ▼                    ▼                      │
  LinkForm             LinkCard × N               │
      │                    │                      │
      └─ onAdd(url) ─┐ ┌───┴─ onDelete(id)        │
                     ▼ ▼                          │
         page.tsx computes `updated` list ────────┤
                     │                            │
                     ▼                            │
         setLinks(updated) → React re-renders     │
```

1. `page.tsx` owns the list of links (the **single source of truth** while the page is open).
2. When the page opens, it loads saved links from storage once.
3. It passes data and callback functions down to children as props.
4. Children never change the list directly. They call the callback.
5. The page computes the new list once, then hands that same value to both `setLinks` (screen) and `saveLinks` (storage).

**Where state lives:** keep state in the lowest component that needs it. The text typed in the form only matters to `LinkForm`, so `LinkForm` owns it. The list of links is needed by both the form (adding) and the cards (deleting), so it lives in their shared parent, `page.tsx`.

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
| `components/LinkCard.tsx` | (inherits client) | Pure display, rendered by a client page |

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
| `loadLinks()` | Reads and parses saved links. Returns `[]` if nothing is saved or the data is broken |
| `saveLinks(links)` | Writes the whole list as JSON |
| `STORAGE_KEY` | The storage key, exported so tests use the exact same value |

**Rules for storage:**

- **Load once, after the first render, in `useEffect`.** Next.js renders pages on the server first, where `localStorage` doesn't exist, so it can't be read during render or in `useState(...)`.
- **Save inside the event handlers** (`addLink`, `deleteLink`), **not in an effect** that watches `links`. Such an effect would run with the empty starting list before loading finishes, and could wipe saved links.
- The load effect needs `// eslint-disable-next-line react-hooks/set-state-in-effect`. The extra render it warns about is harmless here, and the code is temporary until v0.5. Any other lint disable needs a comment explaining why.

## 6. Conventions

- **File names:** components use `PascalCase.tsx` (`LinkCard.tsx`). Everything else uses `camelCase.ts` (`links.ts`).
- **One component per file.** Use a default export named after the file.
- **Props types:** define `type <Component>Props` right above the component.
- **Imports:** use the `@/` alias (`@/types/link`), not long relative paths (`../../types/link`).
- **Type-only imports:** use `import type { ... }` for types.
- **Styling:** use Tailwind utility classes in the JSX. Avoid separate CSS files except `app/globals.css`.
- **IDs and dates:** link IDs come from `crypto.randomUUID()`. Dates are stored as ISO strings (`toISOString()`) and formatted only for display (`formatDate`).

## 7. Testing

Tests use **Vitest** with **React Testing Library**, running in `jsdom` (a fake browser).

- **`lib/` functions** get unit tests: call the function, check the result.
- **Pages and components** get tests that act like a user: type into inputs and click buttons, found by role, label or placeholder, never by CSS class.
- Every new feature comes with tests. Every bug fix gets a test that would have caught the bug.
- `npm run check` (types + lint + tests) must pass before committing.
- **Write the test first** when you can: watch it fail (🔴), then write the code (🟢). A test that never failed hasn't proven anything.
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
