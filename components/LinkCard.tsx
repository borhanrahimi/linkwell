"use client";

import { useState } from "react";
import type { Folder, Link, LinkDetailsInput } from "@/types/link";
import { Badges, EditForm, Favicon, StickyNote } from "@/components/LinkParts";
import { getArchiveUrl, getDomain, timeAgo } from "@/lib/links";

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
  // List view: one compact row instead of a card.
  compact?: boolean;
  // Opens the details panel for this link.
  onShowDetails: (id: string) => void;
};

export default function LinkCard({ link, activeTag, now, folders, compact = false, onDelete, onEditDetails, onMove, onTagClick, onToggleRead, onShowDetails }: LinkCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  // Broken links get a red outline, so they stand out in the grid.
  const tileSize = link.status === "broken" ? "ring-1 ring-danger/50" : "";

  if (isEditing) {
    return (
      <li className={compact ? "p-4" : `glass rounded-2xl p-4 ${tileSize}`}>
        <EditForm
          link={link}
          onSave={(input) => {
            onEditDetails(link.id, input);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      </li>
    );
  }

  const tagButtons = link.tags && link.tags.length > 0 && (
    <ul aria-label="Tags" className={compact ? "flex min-w-0 flex-wrap gap-1" : "mt-1 flex flex-wrap gap-1"}>
      {link.tags.map((tag) => (
        <li key={tag}>
          <button
            onClick={() => onTagClick(tag)}
            aria-pressed={tag === activeTag}
            className={`rounded-full px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              tag === activeTag ? "bg-ink text-canvas" : "bg-hover text-muted hover:text-ink"
            }`}
          >
            #{tag}
          </button>
        </li>
      ))}
    </ul>
  );

  const actions = (
    <>
      <button onClick={() => onShowDetails(link.id)} className="text-sm text-muted hover:text-ink">
        Details
      </button>
      <button onClick={() => onToggleRead(link.id)} className="text-sm text-muted hover:text-success">
        {link.readAt ? "Mark unread" : "Mark read"}
      </button>
      <button onClick={() => setIsEditing(true)} className="text-sm text-muted hover:text-accent">
        Edit
      </button>
      <button onClick={() => onDelete(link.id)} className="text-sm text-muted hover:text-danger">
        Delete
      </button>
    </>
  );

  const titleLink = (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`truncate font-medium hover:underline ${link.readAt ? "text-muted" : "text-accent"}`}
    >
      {link.title || getDomain(link.url)}
    </a>
  );

  const savedAgo = (
    <time dateTime={link.createdAt} title={new Date(link.createdAt).toLocaleDateString()} suppressHydrationWarning>
      {timeAgo(link.createdAt, now)}
    </time>
  );

  // List view: one row. The note, the folder menu and the archive link stay
  // in Cards view (and the details panel).
  if (compact) {
    return (
      // On phones the actions wrap onto their own line under the title.
      <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
        <Favicon url={link.url} size="small" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {titleLink}
            <Badges link={link} now={now} />
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="truncate">{getDomain(link.url)}</span>
            <span aria-hidden="true">·</span>
            {savedAgo}
            {tagButtons}
          </div>
        </div>
        <div className="flex w-full shrink-0 gap-3 pl-10 sm:w-auto sm:pl-0">{actions}</div>
      </li>
    );
  }

  return (
    <li
      className={`glass flex flex-col justify-between gap-3 rounded-2xl p-4 ${tileSize}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Favicon url={link.url} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            {titleLink}
            <Badges link={link} now={now} />
          </div>
          <p className="truncate text-sm text-muted">{link.url}</p>
          {link.note && <StickyNote note={link.note} />}
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
          <p className="text-sm text-muted">Saved {savedAgo}</p>
          {tagButtons}
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
      <div className="flex gap-3 border-t border-line pt-3">{actions}</div>
    </li>
  )
}
