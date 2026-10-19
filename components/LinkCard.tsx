"use client";

import { useState } from "react";
import Image from "next/image";
import type { Folder, Link } from "@/types/link";
import { getArchiveUrl, getDomain, getFaviconUrl, timeAgo } from "@/lib/links";


type LinkCardProps = {
  link: Link;
  onDelete: (id: string) => void;
  onEditTitle: (id: string, title: string) => void;
  onToggleRead: (id: string) => void;
  onMove: (id: string, folderId: string | undefined) => void;
  folders: Folder[];
  onTagClick: (tag: string) => void;
  activeTag: string | null;
  now?: Date;
};

export default function LinkCard({ link, activeTag, now, folders, onDelete, onEditTitle, onMove, onTagClick, onToggleRead }: LinkCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(link.title || "");
  const faviconUrl = getFaviconUrl(link.url);
  // Broken links get a double-width tile, so they stand out in the grid.
  const tileSize = link.status === "broken" ? " ring-1 ring-red-300" : "";

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
      <li className={`glass rounded-2xl p-4 ${tileSize}`}>
        <form onSubmit={handleSave} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Title"
            className="field min-w-0 flex-1"
          />
          <button type="submit" className="btn-primary">
            Save
          </button>
          <button type="button" onClick={cancelEditing} className="btn-quiet">
            Cancel
          </button>
        </form>
      </li>
    );
  }
  return (
    <li
      className={`glass flex flex-col justify-between gap-3 rounded-2xl p-4 ${tileSize} ${link.readAt ? "opacity-75" : ""}`}
    >
      <div className="flex min-w-0 items-start gap-3">
                {/* Every icon sits in the same rounded tile, so square, round and
            transparent icons all line up. The 64px image shown at 24px stays
            sharp on high-resolution (retina) screens. */}
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/80 ring-1 ring-slate-900/10">
          {faviconUrl ? (
            <Image src={faviconUrl} alt="" width={24} height={24} unoptimized className="size-6 rounded" />
          ) : (
            <span aria-hidden="true" className="text-sm font-semibold text-slate-600">
              {getDomain(link.url).charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-medium text-blue-600 hover:underline"
            >
              {link.title || getDomain(link.url)}
            </a>
            {link.status === "broken" && (
              <span
                title={link.checkedAt && `Checked ${timeAgo(link.checkedAt, now)}`}
                className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"
              >
                Broken
              </span>
            )}
          </div>
          <p className="truncate text-sm text-slate-600">{link.url}</p>
          {link.status === "broken" && (
            <a
              href={getArchiveUrl(link.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-amber-700 hover:underline"
            >
              View archived copy
            </a>
          )}
          <p className="text-sm text-slate-600">
            Saved{" "}
            <time
              dateTime={link.createdAt}
              title={new Date(link.createdAt).toLocaleDateString()}
              suppressHydrationWarning
            >
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
          {folders.length > 0 && (
            <select
              value={link.folderId ?? ""}
              onChange={(e) => onMove(link.id, e.target.value || undefined)}
              aria-label="Folder"
              className="mt-2 rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">No folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  📁 {folder.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div className="flex gap-3 border-t border-slate-900/10 pt-3">
        <button onClick={() => onToggleRead(link.id)} className="text-sm text-slate-600 hover:text-green-700">
          {link.readAt ? "Mark unread" : "Mark read"}
        </button>
        <button onClick={startEditing} className="text-sm text-slate-600 hover:text-blue-600">
          Edit
        </button>
        <button
          onClick={() => onDelete(link.id)}
          className="text-sm text-slate-600 hover:text-red-500">
          Delete
        </button>
      </div>
    </li>
  )
}
