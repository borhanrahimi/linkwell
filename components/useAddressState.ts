import { useSyncExternalStore } from "react";
import type { SmartList } from "@/lib/links";
import type { LinkView } from "@/components/useLinkView";

// What the list shows lives in the page's address: /?list=unread,
// /?folder=<id>&tag=react, /?view=list. So the back button steps back through
// what you looked at, a refresh keeps your place, and a list can be bookmarked.
// Search isn't in it: it changes with every key you type.
export type AddressState = {
  list: SmartList;
  folder: string | null;
  tag: string | null;
  // null: no choice in the address, so the device's remembered view is used.
  view: LinkView | null;
};

const LISTS: SmartList[] = ["all", "unread", "broken"];
const listeners = new Set<() => void>();

// Anything odd in the address (a typo, an old link) falls back to the default.
export function readAddress(search: string): AddressState {
  const params = new URLSearchParams(search);
  const list = params.get("list") as SmartList | null;
  const view = params.get("view");
  return {
    list: list && LISTS.includes(list) ? list : "all",
    folder: params.get("folder") || null,
    tag: params.get("tag") || null,
    view: view === "list" || view === "cards" ? view : null,
  };
}

// The back and forward buttons change the address with "popstate"; this tab's
// own changes tell the listeners directly.
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

// serverSearch is the address the server rendered with, so the first render
// in the browser matches it.
export function useAddressState(serverSearch = ""): [AddressState, (changes: Partial<AddressState>, options?: { replace?: boolean }) => void] {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => serverSearch);

  // Changes go into a new history entry (or replace the current one), with
  // defaults left out so the plain address stays "/".
  function update(changes: Partial<AddressState>, { replace = false } = {}) {
    const next = { ...readAddress(window.location.search), ...changes };
    const params = new URLSearchParams();
    if (next.list !== "all") params.set("list", next.list);
    if (next.folder) params.set("folder", next.folder);
    if (next.tag) params.set("tag", next.tag);
    if (next.view) params.set("view", next.view);
    const query = params.toString();
    if (`?${query}` === window.location.search || (!query && !window.location.search)) return;

    const url = query ? `?${query}` : window.location.pathname;
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    listeners.forEach((listener) => listener());
  }

  return [readAddress(search), update];
}
