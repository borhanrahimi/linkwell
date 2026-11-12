"use client";

import { useRef, useState } from "react";
import { DRAG_SOURCE_CLASS, useDrag } from "@/components/DragAndDrop";
import FolderIcon from "@/components/FolderIcon";
import { useFolderOrder } from "@/components/useFolderOrder";
import { useOpenFolders } from "@/components/useOpenFolders";
import { childFolders, flattenTree, folderPath, FOLDER_DOT_CLASS, FOLDER_TEXT_CLASS, placeOf, sortedByName } from "@/lib/folders";
import { FOLDER_NAME_MAX_LENGTH } from "@/lib/links";
import type { Folder } from "@/types/link";

type FolderBarProps = {
  folders: Folder[];
  // How many links each folder holds (with the folders inside it), by folder id.
  counts: Record<string, number>;
  activeFolder: string | null;
  onSelect: (folderId: string | null) => void;
  onCreate: (name: string) => Promise<string | null>;
  // The list's name for screen readers ("Folders" in the sidebar).
  label?: string;
  // Bigger rows, for fingers (the phone's Folders screen).
  roomy?: boolean;
  // Moves a folder with the keyboard: into `parentId` at `index` among the
  // folders there (left out: last). Dragging goes through DragProvider.
  onMove?: (id: string, parentId: string | null, index?: number) => void;
};

// Deep folders stop indenting after 4 levels, so the sidebar fits on phones.
const INDENT = ["", "pl-4", "pl-8", "pl-12", "pl-16"];

// The folders in the sidebar, as a tree: one row each, with the folder's icon
// (or its coloured dot), its name and how many links are in it, then
// "+ New folder". A folder with folders inside has an arrow (▸ closed, ▾
// open); which are open is remembered per device. The keyboard works it like
// a tree: ↑/↓ move between folders, → opens (or goes in), ← closes (or goes
// to the folder it's in).
//
// Folders can be picked up and dropped onto another folder (to go inside it)
// or, in My order, between two (to change the order). The keyboard does the
// same with Alt (Option on a Mac): Alt+↑/↓ move a folder up or down, Alt+→
// puts it inside the folder above it, Alt+← takes it out one level.
export default function FolderBar({ folders: ownOrder, counts, activeFolder, onSelect, onCreate, label = "Folders", roomy = false, onMove }: FolderBarProps) {
  const [order, setOrder] = useFolderOrder();
  const folders = order === "name" ? sortedByName(ownOrder) : ownOrder;
  const drag = useDrag();
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

  // Alt+arrows: the keyboard's way of dragging. Places are worked out in your
  // own order, which is what gets saved.
  function moveWithKeys(id: string, key: string) {
    if (!onMove) return;
    const { parentId, index } = placeOf(ownOrder, id);
    const name = ownOrder.find((f) => f.id === id)?.name;
    if (key === "ArrowUp" || key === "ArrowDown") {
      if (order === "name") {
        drag.announce("Folders are sorted A to Z. Choose My order to move them up or down.");
        return;
      }
      const next = index + (key === "ArrowUp" ? -1 : 1);
      if (next < 0 || next >= childFolders(ownOrder, parentId).length) {
        drag.announce(`${name} is already ${next < 0 ? "first" : "last"}`);
        return;
      }
      onMove(id, parentId, next);
    } else if (key === "ArrowLeft") {
      if (!parentId) {
        drag.announce(`${name} is already at the top level`);
        return;
      }
      // Out of its folder, just after it.
      const parent = placeOf(ownOrder, parentId);
      onMove(id, parent.parentId, parent.index + 1);
    } else {
      // Into the folder above it, as you see them, at the end.
      const above = childFolders(folders, parentId)[childFolders(folders, parentId).findIndex((f) => f.id === id) - 1];
      if (!above) {
        drag.announce(`There's no folder above ${name} to put it in`);
        return;
      }
      setOpen(above.id, true);
      onMove(id, above.id);
    }
    // The row moved: keep the keyboard on it.
    requestAnimationFrame(() => focusFolder(id));
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const id = (event.target as HTMLElement).dataset.folder;
    if (!id) return;
    if (event.altKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      moveWithKeys(id, event.key);
      return;
    }
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
      <ul ref={list} aria-label={label} onKeyDown={onKeyDown} className="space-y-0.5">
        {rows.map(({ folder, depth }) => {
          const hasInside = childFolders(folders, folder.id).length > 0;
          const isOpen = open.has(folder.id);
          const over = drag.over?.folderId === folder.id ? drag.over.where : null;
          const pickedUp = drag.item?.kind === "folder" && drag.item.id === folder.id;
          return (
          <li key={folder.id} className={INDENT[Math.min(depth, INDENT.length - 1)]}>
            <div className="relative">
            {/* Where a folder being dragged would land: a line before or after this one. */}
            {(over === "before" || over === "after") && (
              <span aria-hidden="true" className={`absolute inset-x-1 z-20 h-0.5 rounded-full bg-[#0071e3] ${over === "before" ? "-top-px" : "-bottom-px"}`} />
            )}
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
              data-drop-folder={folder.id}
              data-drop-reorder={order === "mine" ? "" : undefined}
              {...drag.dragSource(() => ({ kind: "folder", id: folder.id, name: folder.name }))}
              onClick={() => onSelect(folder.id === activeFolder ? null : folder.id)}
              aria-pressed={folder.id === activeFolder}
              // Screen readers hear whether its folders are showing, and how deep it is.
              aria-expanded={hasInside ? isOpen : undefined}
              aria-description={depth > 0 ? `Inside ${folderPath(folders, folder.id).at(-2)?.name}` : undefined}
              aria-keyshortcuts={onMove ? "Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight" : undefined}
              className={`sidebar-item ${DRAG_SOURCE_CLASS} ${roomy ? "py-3 text-base" : ""} ${folder.id === activeFolder ? "sidebar-item-active" : ""} ${over === "into" ? "drop-into" : ""} ${pickedUp ? "opacity-50" : ""}`}
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
        <div className="flex items-center gap-1">
          <button onClick={() => setIsCreating(true)} className="sidebar-item min-w-0 flex-1 text-muted">
            + New folder
          </button>
          {/* Your own order (drag folders to change it) or A to Z. */}
          {ownOrder.length > 1 && (
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value as "mine" | "name")}
              aria-label="Folder order"
              className="shrink-0 rounded-md bg-transparent py-1 text-xs text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <option value="mine">My order</option>
              <option value="name">A to Z</option>
            </select>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 px-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
