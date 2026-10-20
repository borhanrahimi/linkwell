"use client";

import { useState } from "react";
import FolderIcon from "@/components/FolderIcon";
import { FOLDER_DOT_CLASS, FOLDER_TEXT_CLASS } from "@/lib/folders";
import type { Folder } from "@/types/link";

type FolderBarProps = {
  folders: Folder[];
  activeFolder: string | null;
  onSelect: (folderId: string | null) => void;
  onCreate: (name: string) => Promise<string | null>;
};

function pill(active: boolean) {
  return `rounded-full px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 ${
    active ? "bg-ink text-canvas" : "bg-surface text-ink ring-1 ring-line hover:bg-canvas"
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
      <div className="flex flex-wrap items-center gap-2">
        <ul aria-label="Folders" className="flex flex-wrap gap-2">
          {folders.length > 0 && (
            <li>
              <button onClick={() => onSelect(null)} aria-pressed={activeFolder === null} className={pill(activeFolder === null)}>
                All links
              </button>
            </li>
          )}
          {folders.map((folder) => (
            <li key={folder.id}>
              <button
                onClick={() => onSelect(folder.id === activeFolder ? null : folder.id)}
                aria-pressed={folder.id === activeFolder}
                className={pill(folder.id === activeFolder)}
              >
                {folder.icon ? (
                  <FolderIcon
                    name={folder.icon}
                    className={`mr-1.5 inline-block size-4 align-[-3px] ${FOLDER_TEXT_CLASS[folder.color ?? "gray"]}`}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className={`mr-1.5 inline-block size-2.5 rounded-full ${FOLDER_DOT_CLASS[folder.color ?? "gray"]}`}
                  />
                )}
                {folder.name}
              </button>
            </li>
          ))}
        </ul>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="rounded-full border border-dashed border-line px-3 py-1.5 text-sm font-medium text-muted hover:border-muted hover:text-ink"
          >
            + New folder
          </button>
        )}
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
