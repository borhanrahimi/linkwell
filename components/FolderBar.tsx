"use client";

import { useState } from "react";
import type { Folder } from "@/types/link";

type FolderBarProps = {
  folders: Folder[];
  activeFolder: string | null;
  onSelect: (folderId: string | null) => void;
  onCreate: (name: string) => Promise<string | null>;
};

function pill(active: boolean) {
  return `rounded-full px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 ${
    active ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-black/10 hover:bg-slate-50"
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
                📁 {folder.name}
              </button>
            </li>
          ))}
        </ul>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="rounded-full border border-dashed border-black/20 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-black/30 hover:text-slate-800"
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
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
