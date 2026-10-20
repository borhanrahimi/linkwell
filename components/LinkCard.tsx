"use client";

import { useState } from "react";
import Image from "next/image";
import type { Folder, Link, LinkDetailsInput } from "@/types/link";
import { getArchiveUrl, getDomain, getFaviconUrl, NOTE_MAX_LENGTH, timeAgo } from "@/lib/links";


type LinkCardProps = {
  link: Link;
  onDelete: (id: string) => void;
  onEditDetails: (id: string, input: LinkDetailsInput) => void;
  onToggleRead: (id: string) => void;
  onMove: (id: string, folderId: string | undefined) => void;
  folders: Folder[];
  onTagClick: (tag: string) => void;
  activeTag: string | null;
  now?: Date;
};

export default function LinkCard({ link, activeTag, now, folders, onDelete, onEditDetails, onMove, onTagClick, onToggleRead }: LinkCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  // The Edit form's three boxes, filled from the link when editing starts.
  const [draft, setDraft] = useState<LinkDetailsInput>({ title: "", tags: "", note: "" });
  const faviconUrl = getFaviconUrl(link.url);
  // Broken links get a double-width tile, so they stand out in the grid.
  const tileSize = link.status === "broken" ? "ring-1 ring-danger/50" : "";

  function startEditing() {
    setDraft({ title: link.title || "", tags: (link.tags ?? []).join(", "), note: link.note || "" });
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    onEditDetails(link.id, draft);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <li className={`glass rounded-2xl p-4 ${tileSize}`}>
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Title
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder={getDomain(link.url)}
              className="field font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Tags
            <input
              type="text"
              value={draft.tags}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              placeholder="Comma separated"
              className="field font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Note
            <textarea
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="Why did you save this?"
              maxLength={NOTE_MAX_LENGTH}
              rows={3}
              className="field-area font-normal"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="submit" className="btn-primary">
              Save
            </button>
            <button type="button" onClick={cancelEditing} className="btn-quiet">
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }
  return (
    <li
      className={`glass flex flex-col justify-between gap-3 rounded-2xl p-4 ${tileSize}`}
    >
      <div className="flex min-w-0 items-start gap-3">
                {/* Every icon sits in the same rounded tile, so square, round and
            transparent icons all line up. The 64px image shown at 24px stays
            sharp on high-resolution (retina) screens. */}
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-line">
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
              className={`truncate font-medium hover:underline ${link.readAt ? "text-muted" : "text-accent"}`}
            >
              {link.title || getDomain(link.url)}
            </a>
            {/* Read links get a grey title and a label instead of fading the
                whole card, because faded text became too hard to read. */}
            {link.readAt && (
              <span className="shrink-0 rounded-full bg-hover px-2 py-0.5 text-xs font-semibold text-muted">Read</span>
            )}
            {link.status === "broken" && (
              <span
                title={link.checkedAt && `Checked ${timeAgo(link.checkedAt, now)}`}
                className="shrink-0 rounded-full bg-danger/15 px-2 py-0.5 text-xs font-semibold text-danger"
              >
                Broken
              </span>
            )}
          </div>
          <p className="truncate text-sm text-muted">{link.url}</p>
          {link.note && (
            // whitespace-pre-line keeps the line breaks typed in the note.
            <p className="mt-1 line-clamp-3 whitespace-pre-line border-l-2 border-line pl-2 text-sm text-ink">
              {link.note}
            </p>
          )}
          {link.status === "broken" && (
            <a
              href={getArchiveUrl(link.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-warning hover:underline"
            >
              View archived copy
            </a>
          )}
          <p className="text-sm text-muted">
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
                      ? "bg-ink text-canvas"
                      : "bg-hover text-muted hover:text-ink"
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
              className="mt-2 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">No folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div className="flex gap-3 border-t border-line pt-3">
        <button onClick={() => onToggleRead(link.id)} className="text-sm text-muted hover:text-success">
          {link.readAt ? "Mark unread" : "Mark read"}
        </button>
        <button onClick={startEditing} className="text-sm text-muted hover:text-accent">
          Edit
        </button>
        <button
          onClick={() => onDelete(link.id)}
          className="text-sm text-muted hover:text-danger">
          Delete
        </button>
      </div>
    </li>
  )
}
