import { useSyncExternalStore } from "react";

// Cards (the grid) or List (one compact row per link): remembered per
// device in localStorage, so each computer or phone keeps its own choice.
export type LinkView = "cards" | "list";

const STORAGE_KEY = "linkwell:view";
const listeners = new Set<() => void>();

function readView(): LinkView {
  try {
    return localStorage.getItem(STORAGE_KEY) === "list" ? "list" : "cards";
  } catch {
    // Storage can be blocked (private windows, strict settings): use cards.
    return "cards";
  }
}

// Other tabs change it through the "storage" event; this tab tells its own listeners.
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useLinkView(): [LinkView, (view: LinkView) => void] {
  // The server can't see localStorage, so it renders cards; the browser then
  // switches to the saved view.
  const view = useSyncExternalStore(subscribe, readView, () => "cards" as const);

  function setView(next: LinkView) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered, but still switched for now.
    }
    listeners.forEach((listener) => listener());
  }

  return [view, setView];
}
