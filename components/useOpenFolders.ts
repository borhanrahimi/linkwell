import { useSyncExternalStore } from "react";

// Which folders are open (▾) in the sidebar's tree: remembered per device in
// localStorage, like the cards/list choice, as a list of folder ids.
const STORAGE_KEY = "linkwell:open-folders";
const listeners = new Set<() => void>();
// Used when storage is blocked (private windows, strict settings), so the
// arrows still work until the page closes.
let inMemory = "[]";

// The raw text is the snapshot: a string, so React sees it unchanged until
// it really changes.
function readStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return inMemory;
  }
}

function parse(text: string): string[] {
  try {
    const ids = JSON.parse(text);
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
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

export function useOpenFolders(): [Set<string>, (id: string, open: boolean) => void] {
  // The server can't see localStorage: every folder starts closed there.
  const stored = useSyncExternalStore(subscribe, readStored, () => "[]");
  const open = new Set(parse(stored));

  function setOpen(id: string, isOpen: boolean) {
    const next = new Set(parse(readStored()));
    if (isOpen) next.add(id);
    else next.delete(id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      inMemory = JSON.stringify([...next]);
    }
    listeners.forEach((listener) => listener());
  }

  return [open, setOpen];
}
