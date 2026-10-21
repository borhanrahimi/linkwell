"use client";

import { useState } from "react";
import FolderIcon from "@/components/FolderIcon";
import { FOLDER_DOT_CLASS, FOLDER_TEXT_CLASS } from "@/lib/folders";
import { FOLDER_NAME_MAX_LENGTH } from "@/lib/links";
import type { Folder } from "@/types/link";

type FolderBarProps = {
  folders: Folder[];
  // How many links each folder holds, by folder id.
  counts: Record<string, number>;
  activeFolder: string | null;
  onSelect: (folderId: string | null) => void;
  onCreate: (name: string) => Promise<string | null>;
};

// The folders in the sidebar: one row each, with the folder's icon (or its
// coloured dot), its name and how many links are in it, then "+ New folder".
export default function FolderBar({ folders, counts, activeFolder, onSelect, onCreate }: FolderBarProps) {
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
      <ul aria-label="Folders" className="space-y-0.5">
        {folders.map((folder) => (
          <li key={folder.id}>
            <button
              onClick={() => onSelect(folder.id === activeFolder ? null : folder.id)}
              aria-pressed={folder.id === activeFolder}
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
          </li>
        ))}
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
