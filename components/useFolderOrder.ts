import { useSyncExternalStore } from "react";

// The sidebar's folders in your own order (the one you drag them into) or A
// to Z: remembered per device in localStorage, like the cards/list choice.
export type FolderOrder = "mine" | "name";

const STORAGE_KEY = "linkwell:folder-order";
const listeners = new Set<() => void>();

function readOrder(): FolderOrder {
  try {
    return localStorage.getItem(STORAGE_KEY) === "name" ? "name" : "mine";
  } catch {
    return "mine";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useFolderOrder(): [FolderOrder, (order: FolderOrder) => void] {
  const order = useSyncExternalStore(subscribe, readOrder, () => "mine" as const);

  function setOrder(next: FolderOrder) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered, but still switched for now.
    }
    listeners.forEach((listener) => listener());
  }

  return [order, setOrder];
}
