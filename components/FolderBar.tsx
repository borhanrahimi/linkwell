"use client";

import { useState } from "react";
import type { Folder } from "@/types/link";

type FolderBarProps = {
  folders: Folder[];
  onCreate: (name: string) => Promise<string | null>;
};

export default function FolderBar({ folders, onCreate }: FolderBarProps) {
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
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <ul aria-label="Folders" className="flex flex-wrap gap-2">
          {folders.map((folder) => (
            <li key={folder.id} className="rounded-full bg-white px-3 py-1 text-sm text-slate-700 shadow-sm">
              📁 {folder.name}
            </li>
          ))}
        </ul>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700"
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
            className="flex-1 rounded border border-slate-300 px-3 py-1 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
          <button
            type="submit"
            className="rounded bg-slate-700 px-3 py-1 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Create
          </button>
          <button type="button" onClick={cancel} className="rounded px-3 py-1 text-sm text-slate-600 hover:bg-slate-100">
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
