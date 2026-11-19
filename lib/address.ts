import type { SmartList } from "@/lib/links";

// What the list shows lives in the page's address: / is Home, /?list=all,
// /?list=unread, /?folder=<id>&tag=react, /?view=list. So the back button steps back through
// what you looked at, a refresh keeps your place, and a list can be bookmarked.
// Search isn't in it: it changes with every key you type.
export type AddressState = {
  list: SmartList;
  folder: string | null;
  tag: string | null;
  // null: no choice in the address, so the device's remembered view is used.
  view: "cards" | "list" | null;
};

const LISTS: SmartList[] = ["home", "all", "unread", "broken", "unsorted", "trash", "folders"];

// Anything odd in the address (a typo, an old link) falls back to the default.
export function readAddress(search: string): AddressState {
  const params = new URLSearchParams(search);
  const list = params.get("list") as SmartList | null;
  const view = params.get("view");
  return {
    list: list && LISTS.includes(list) ? list : "home",
    folder: params.get("folder") || null,
    tag: params.get("tag") || null,
    view: view === "list" || view === "cards" ? view : null,
  };
}

