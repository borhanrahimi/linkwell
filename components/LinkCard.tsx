"use client";

import { useState } from "react";
import Image from "next/image";
import type { Folder, Link, LinkDetailsInput } from "@/types/link";
import Checkmark from "@/components/illustrations/Checkmark";
import SnappedChain from "@/components/illustrations/SnappedChain";
import { getArchiveUrl, getDomain, getFaviconUrl, NOTE_MAX_LENGTH, TITLE_MAX_LENGTH, timeAgo } from "@/lib/links";


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
};

// The site's icon in a rounded tile, so square, round and transparent icons
// all line up. The 64px image shown smaller stays sharp on retina screens.
function Favicon({ url, small = false }: { url: string; small?: boolean }) {
  const faviconUrl = getFaviconUrl(url);
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-white ring-1 ring-line ${
        small ? "size-7 rounded-lg" : "size-10 rounded-xl"
      }`}
    >
      {faviconUrl ? (
        <Image src={faviconUrl} alt="" width={24} height={24} unoptimized className={`${small ? "size-4" : "size-6"} rounded`} />
      ) : (
        <span aria-hidden="true" className="text-sm font-semibold text-slate-600">
          {getDomain(url).charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

// "Read" with a hand-drawn tick, and "Broken" with a snapped chain.
function Badges({ link, now }: { link: Link; now?: Date }) {
  return (
    <>
      {/* Read links get a grey title and a label instead of fading the
          whole card, because faded text became too hard to read. */}
      {link.readAt && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-hover px-2 py-0.5 text-xs font-semibold text-muted">
          <Checkmark className="size-3.5 text-success" />
          Read
        </span>
      )}
      {link.status === "broken" && (
        <span
          title={link.checkedAt && `Checked ${timeAgo(link.checkedAt, now)}`}
          className="flex shrink-0 items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-xs font-semibold text-danger"
        >
          <SnappedChain className="size-3.5" />
          Broken
        </span>
      )}
    </>
  );
}

export default function LinkCard({ link, activeTag, now, folders, compact = false, onDelete, onEditDetails, onMove, onTagClick, onToggleRead }: LinkCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  // The Edit form's three boxes, filled from the link when editing starts.
  const [draft, setDraft] = useState<LinkDetailsInput>({ title: "", tags: "", note: "" });
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
      <li className={compact ? "p-4" : `glass rounded-2xl p-4 ${tileSize}`}>
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Title
            <input
              type="text"
              value={draft.title}
              maxLength={TITLE_MAX_LENGTH}
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
      <button onClick={() => onToggleRead(link.id)} className="text-sm text-muted hover:text-success">
        {link.readAt ? "Mark unread" : "Mark read"}
      </button>
      <button onClick={startEditing} className="text-sm text-muted hover:text-accent">
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
        <Favicon url={link.url} small />
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
          {link.note && (
            // A small sticky note: paper colour, a slight tilt, and a strip of
            // tape on top. whitespace-pre-line keeps the line breaks typed in it.
            <div className="relative mt-3 mb-1 w-fit max-w-full -rotate-1 rounded-sm bg-paper px-3 pt-2.5 pb-2 shadow-sm">
              <span aria-hidden="true" className="absolute -top-1.5 left-1/2 h-3 w-10 -translate-x-1/2 rotate-2 bg-tape shadow-sm" />
              <p className="line-clamp-3 whitespace-pre-line text-sm text-ink">{link.note}</p>
            </div>
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
