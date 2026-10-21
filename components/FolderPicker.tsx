"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FOLDER_NAME_MAX_LENGTH } from "@/lib/links";
import type { Folder } from "@/types/link";

// The menu's own choice for "make a new folder"; no folder id looks like it.
const NEW_FOLDER = "new-folder";

type FolderPickerProps = {
  folders: Folder[];
  // The chosen folder's id, or "" for no folder.
  value: string;
  onChange: (folderId: string) => void;
  // Makes the folder; returns it, or an error message to show.
  onCreate: (name: string) => Promise<Folder | string>;
};

// Where a link is saved to, like a browser's bookmark dialog: "No folder",
// your folders, and "New folder…", which swaps the menu for a name box and,
// once created, picks the new folder.
export default function FolderPicker({ folders, value, onChange, onCreate }: FolderPickerProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameBox = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) nameBox.current?.focus();
  }, [creating]);

  function cancel() {
    setCreating(false);
    setName("");
    setError(null);
  }

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const result = await onCreate(name);
    setBusy(false);
    if (typeof result === "string") {
      setError(result);
      return;
    }
    onChange(result.id);
    cancel();
  }

  if (creating) {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 gap-2">
          <input
            ref={nameBox}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            // Enter makes the folder (not the link); Esc goes back to the menu.
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              } else if (e.key === "Escape") {
                cancel();
              }
            }}
            aria-label="New folder name"
            placeholder="New folder name"
            maxLength={FOLDER_NAME_MAX_LENGTH}
            className="field min-w-0 flex-1"
          />
          <button type="button" onClick={create} disabled={busy} className="btn-secondary">
            {busy ? "Creating..." : "Create"}
          </button>
          <button type="button" onClick={cancel} className="btn-quiet">
            Cancel
          </button>
        </div>
        {error && (
          <p role="alert" className="px-1 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => (e.target.value === NEW_FOLDER ? setCreating(true) : onChange(e.target.value))}
      aria-label="Save to folder"
      className="field min-w-0"
    >
      <option value="">No folder</option>
      {folders.map((folder) => (
        <option key={folder.id} value={folder.id}>
          {folder.name}
        </option>
      ))}
      <option value={NEW_FOLDER}>New folder…</option>
    </select>
  );
}

// The folder last saved to from the share page, remembered on this device
// like a browser's bookmark dialog does, so saving several links into one
// folder takes one click each.
const LAST_FOLDER_KEY = "linkwell:last-folder";
const lastFolderListeners = new Set<() => void>();

function readLastFolder() {
  try {
    return localStorage.getItem(LAST_FOLDER_KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribeLastFolder(listener: () => void) {
  lastFolderListeners.add(listener);
  return () => {
    lastFolderListeners.delete(listener);
  };
}

export function useLastFolder(): [string, (folderId: string) => void] {
  const last = useSyncExternalStore(subscribeLastFolder, readLastFolder, () => "");

  function remember(folderId: string) {
    try {
      localStorage.setItem(LAST_FOLDER_KEY, folderId);
    } catch {
      // Not remembered; nothing else changes.
    }
    lastFolderListeners.forEach((listener) => listener());
  }

  return [last, remember];
}
