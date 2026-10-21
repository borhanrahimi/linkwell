"use client";

import { useState } from "react";
import FolderIcon from "@/components/FolderIcon";
import { FOLDER_DOT_CLASS, FOLDER_TEXT_CLASS } from "@/lib/folders";
import { FOLDER_NAME_MAX_LENGTH } from "@/lib/links";
import type { Folder } from "@/types/link";

type FolderBarProps = {
  folders: Folder[];
  activeFolder: string | null;
  onSelect: (folderId: string | null) => void;
  onCreate: (name: string) => Promise<string | null>;
};

// Folders look like the tabs on notebook dividers: rounded on top, standing on
// a line. Every tab carries its own piece of that line (the border under each
// <li>), so when tabs wrap onto a second row, that row stands on a line too.
// The open tab is white and covers the line (-mb-px), so it joins the page
// below it, where the folder's icon, colour and name are changed.
function tab(active: boolean) {
  return `relative -mb-px flex items-center overflow-hidden rounded-t-lg border border-line px-3 pt-2.5 pb-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 ${
    active ? "border-b-surface bg-surface font-semibold text-ink" : "bg-hover font-medium text-muted hover:text-ink"
  }`;
}

export default function FolderBar({ folders, activeFolder, onSelect, onCreate }: FolderBarProps) {
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
    <div className="mt-3">
      <div className="flex flex-wrap items-end gap-y-2">
        <ul aria-label="Folders" className="flex flex-wrap gap-y-2">
          {folders.length > 0 && (
            <li className="border-b border-line pr-1">
              <button onClick={() => onSelect(null)} aria-pressed={activeFolder === null} className={tab(activeFolder === null)}>
                All links
              </button>
            </li>
          )}
          {folders.map((folder) => (
            <li key={folder.id} className="border-b border-line pr-1">
              <button
                onClick={() => onSelect(folder.id === activeFolder ? null : folder.id)}
                aria-pressed={folder.id === activeFolder}
                className={tab(folder.id === activeFolder)}
              >
                {/* The folder's colour, as a strip along the top of the tab. */}
                <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${FOLDER_DOT_CLASS[folder.color ?? "gray"]}`} />
                {folder.icon && (
                  <FolderIcon
                    name={folder.icon}
                    className={`mr-1.5 size-4 shrink-0 ${FOLDER_TEXT_CLASS[folder.color ?? "gray"]}`}
                  />
                )}
                {folder.name}
              </button>
            </li>
          ))}
        </ul>
        {/* Carries the line on to the end of the row, under "+ New folder". */}
        <div className="flex-1 border-b border-line pb-1 pl-1">
          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="whitespace-nowrap rounded-lg border border-dashed border-line px-3 py-1 text-sm font-medium text-muted hover:border-muted hover:text-ink"
            >
              + New folder
            </button>
          )}
        </div>
      </div>
      {isCreating && (
        <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
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
            className="field min-w-0 flex-1"
          />
          <button type="submit" className="btn-secondary">
            Create
          </button>
          <button type="button" onClick={cancel} className="btn-quiet">
            Cancel
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
