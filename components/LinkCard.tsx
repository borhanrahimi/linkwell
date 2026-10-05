"use client";

import { useState } from "react";
import type { Link } from "@/types/link";
import { formatDate, getDomain } from "@/lib/links";


type LinkCardProps = {
  link: Link;
  onDelete: (id: string) => void;
  onEditTitle: (id: string, title: string) => void;
};

export default function LinkCard({ link, onDelete, onEditTitle }: LinkCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(link.title || "");

  function startEditing() {
    setDraft(link.title || "");
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    onEditTitle(link.id, draft);
    setIsEditing(false);
  }

  if (isEditing)
    return (
      <li className="rounded-lg bg-white p-4 shadow-sm">
        <form onSubmit={handleSave} className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
          <button
            type="submit"
            className="rounded bg-blue-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
          >
            Save
          </button>
          <button
            type="button"
            onClick={cancelEditing}
            className="rounded bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
          >
            Cancel
          </button>
        </form>
      </li>
    );
  return (
    <li className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate font-medium text-blue-600 hover:underline"
        >
          {link.title || getDomain(link.url)}
        </a>
        <p className="text-sm text-slate-400">Saved {formatDate(link.createdAt)}</p>
      </div>
      <div className="ml-4 flex shrink-0 gap-3">
        <button onClick={startEditing}className="text-sm text-slate-400 hover:text-blue-600">
        Edit
        </button>
        <button
        onClick={() => onDelete(link.id)}
        className="text-sm text-slate-400 hover:text-red-500">
        Delete 
        </button>
      </div>
    </li>
  )
}
