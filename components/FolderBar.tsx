"use client";

import { useRef, useState } from "react";
import FolderIcon from "@/components/FolderIcon";
import { useOpenFolders } from "@/components/useOpenFolders";
import { childFolders, flattenTree, folderPath, FOLDER_DOT_CLASS, FOLDER_TEXT_CLASS } from "@/lib/folders";
import { FOLDER_NAME_MAX_LENGTH } from "@/lib/links";
import type { Folder } from "@/types/link";

type FolderBarProps = {
  folders: Folder[];
  // How many links each folder holds (with the folders inside it), by folder id.
  counts: Record<string, number>;
  activeFolder: string | null;
  onSelect: (folderId: string | null) => void;
  onCreate: (name: string) => Promise<string | null>;
};

// Deep folders stop indenting after 4 levels, so the sidebar fits on phones.
const INDENT = ["", "pl-4", "pl-8", "pl-12", "pl-16"];

// The folders in the sidebar, as a tree: one row each, with the folder's icon
// (or its coloured dot), its name and how many links are in it, then
// "+ New folder". A folder with folders inside has an arrow (▸ closed, ▾
// open); which are open is remembered per device. The keyboard works it like
// a tree: ↑/↓ move between folders, → opens (or goes in), ← closes (or goes
// to the folder it's in).
export default function FolderBar({ folders, counts, activeFolder, onSelect, onCreate }: FolderBarProps) {
  const [stored, setOpen] = useOpenFolders();
  // The open folder's own parents are always open, so it can be seen.
  const open = new Set(stored);
  if (activeFolder) {
    for (const parent of folderPath(folders, activeFolder).slice(0, -1)) open.add(parent.id);
  }
  // Shown: every top-level folder, and those whose parents are all open.
  const rows = flattenTree(folders).filter(({ folder }) =>
    folderPath(folders, folder.id)
      .slice(0, -1)
      .every((parent) => open.has(parent.id))
  );
  const list = useRef<HTMLUListElement>(null);

  function focusFolder(id: string | undefined) {
    if (id) list.current?.querySelector<HTMLButtonElement>(`[data-folder="${id}"]`)?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const id = (event.target as HTMLElement).dataset.folder;
    if (!id) return;
    const at = rows.findIndex((row) => row.folder.id === id);
    const hasInside = childFolders(folders, id).length > 0;
    let handled = true;
    if (event.key === "ArrowDown") focusFolder(rows[at + 1]?.folder.id);
    else if (event.key === "ArrowUp") focusFolder(rows[at - 1]?.folder.id);
    else if (event.key === "ArrowRight" && hasInside) {
      if (open.has(id)) focusFolder(childFolders(folders, id)[0]?.id);
      else setOpen(id, true);
    } else if (event.key === "ArrowLeft") {
      if (hasInside && open.has(id) && stored.has(id)) setOpen(id, false);
      else focusFolder(folderPath(folders, id).at(-2)?.id);
    } else handled = false;
    if (handled) event.preventDefault();
  }

  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const message = await onCreate(name);
    if (message) {
      setError(message);
      return;
    }
    setName("");
    setError(null);
    setIsCreating(false);
  }

  function cancel() {
    setName("");
    setError(null);
    setIsCreating(false);
  }

  return (
    <div>
      <ul ref={list} aria-label="Folders" onKeyDown={onKeyDown} className="space-y-0.5">
        {rows.map(({ folder, depth }) => {
          const hasInside = childFolders(folders, folder.id).length > 0;
          const isOpen = open.has(folder.id);
          return (
          <li key={folder.id} className={INDENT[Math.min(depth, INDENT.length - 1)]}>
            <div className="relative">
            {/* The arrow hangs in the margin left of the row, so every folder's
              icon lines up with the others and with the lists above. */}
            {hasInside && (
              <button
                onClick={() => setOpen(folder.id, !isOpen)}
                aria-expanded={isOpen}
                aria-label={`${isOpen ? "Hide" : "Show"} folders in ${folder.name}`}
                tabIndex={-1}
                className="absolute -left-3.5 top-1/2 z-10 grid size-5 -translate-y-1/2 place-items-center rounded text-muted hover:text-ink"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`size-3 transition-transform ${isOpen ? "rotate-90" : ""}`}>
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            )}
            <button
              data-folder={folder.id}
              onClick={() => onSelect(folder.id === activeFolder ? null : folder.id)}
              aria-pressed={folder.id === activeFolder}
              // Screen readers hear whether its folders are showing, and how deep it is.
              aria-expanded={hasInside ? isOpen : undefined}
              aria-description={depth > 0 ? `Inside ${folderPath(folders, folder.id).at(-2)?.name}` : undefined}
              className={`sidebar-item ${folder.id === activeFolder ? "sidebar-item-active" : ""}`}
            >
              {folder.icon ? (
                <FolderIcon name={folder.icon} className={`size-4 shrink-0 ${FOLDER_TEXT_CLASS[folder.color ?? "gray"]}`} />
              ) : (
                // mx-[3px]: the dot takes the same width as an icon, so names line up.
                <span aria-hidden="true" className={`mx-[3px] size-2.5 shrink-0 rounded-full ${FOLDER_DOT_CLASS[folder.color ?? "gray"]}`} />
              )}
              <span className="min-w-0 flex-1 truncate">{folder.name}</span>
              {/* Counts are for the eye: in the button's name they'd turn "Work" into "Work 3". */}
              <span aria-hidden="true" className="text-xs text-muted">
                {counts[folder.id] ?? 0}
              </span>
            </button>
            </div>
          </li>
          );
        })}
      </ul>
      {isCreating ? (
        <form onSubmit={handleSubmit} className="mt-2 space-y-2">
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            aria-label="Folder name"
            maxLength={FOLDER_NAME_MAX_LENGTH}
            placeholder="Folder name"
            autoFocus
            className="field w-full"
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-secondary">
              Create
            </button>
            <button type="button" onClick={cancel} className="btn-quiet">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setIsCreating(true)} className="sidebar-item text-muted">
          + New folder
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 px-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
