"use client";

import { useState } from "react";
import Image from "next/image";
import type { Link } from "@/types/link";
import { getDomain, getFaviconUrl, timeAgo } from "@/lib/links";


type LinkCardProps = {
  link: Link;
  onDelete: (id: string) => void;
  onEditTitle: (id: string, title: string) => void;
  onTagClick: (tag: string) => void;
  activeTag: string | null;
  now?: Date;
};

export default function LinkCard({ link, activeTag, now, onDelete, onEditTitle, onTagClick }: LinkCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(link.title || "");
  const faviconUrl = getFaviconUrl(link.url);

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

  if (isEditing) {
    return (
      <li className="rounded-lg bg-white p-4 shadow-sm">
        <form onSubmit={handleSave} className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Title"
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
  }
  return (
    <li className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        {faviconUrl && (
          <Image src={faviconUrl} alt="" width={30} height={30} unoptimized className="shrink-0" />)}
        <div className="min-w-0">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate font-medium text-blue-600 hover:underline"
          >
            {link.title || getDomain(link.url)}
          </a>
          <p className="truncate text-sm text-slate-500">{link.url}</p>
          <p className="text-sm text-slate-400">
            Saved{" "}
            <time dateTime={link.createdAt} title={new Date(link.createdAt).toLocaleDateString()}>
              {timeAgo(link.createdAt, now)}
            </time>
          </p>
          {link.tags && link.tags.length > 0 && (
            <ul aria-label="Tags" className="mt-1 flex flex-wrap gap-1">
              {link.tags.map((tag) => (
                <li key={tag}>
                  <button
                    onClick={() => onTagClick(tag)}
                    aria-pressed={tag === activeTag}
                    className={`rounded-full px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 ${tag === activeTag
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700"
                      }`}
                  >

                    #{tag}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="ml-4 flex shrink-0 gap-3">
        <button onClick={startEditing} className="text-sm text-slate-400 hover:text-blue-600">
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
