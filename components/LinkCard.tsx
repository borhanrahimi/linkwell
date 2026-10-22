"use client";

import { useState } from "react";
import type { Folder, Link, LinkDetailsInput } from "@/types/link";
import { Badges, EditForm, Favicon, PreviewImage, StickyNote } from "@/components/LinkParts";
import { getArchiveUrl, getDomain, timeAgo } from "@/lib/links";
import { FOLDER_DOT_CLASS } from "@/lib/folders";

type LinkCardProps = {
  link: Link;
  onDelete: (id: string) => void;
  onEditDetails: (id: string, input: LinkDetailsInput) => void;
  onToggleRead: (id: string) => void;
  // To show the link's folder; moving it happens in the details panel.
  folders: Folder[];
  onTagClick: (tag: string) => void;
  activeTag: string | null;
  now?: Date;
  // List view: one compact row instead of a card.
  compact?: boolean;
  // Opens the details panel for this link.
  onShowDetails: (id: string) => void;
  // Select mode: a tick box on each link, and tapping the card ticks it.
  selecting?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
};

// Clicks on the card's own controls (title, buttons, tags) do their own thing;
// a click anywhere else on the card opens its details, or ticks it in Select mode.
function onCardBackground(event: React.MouseEvent) {
  return !(event.target as Element).closest("a, button, input, select, textarea, label");
}

export default function LinkCard({ link, activeTag, now, folders, compact = false, onDelete, onEditDetails, onTagClick, onToggleRead, onShowDetails, selecting = false, selected = false, onToggleSelect }: LinkCardProps) {
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

  // Mark read and Details are always there. Edit and Delete only show while a
  // mouse is over the card (or the keyboard is in it); on touch screens, where
  // nothing hovers, they're in the details panel instead.
  const action = "btn-quiet px-2.5 py-1 font-normal text-muted";
  const onHover =
    "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:none)]:hidden";
  const actions = (
    <>
      <button onClick={() => onToggleRead(link.id)} className={`${action} hover:text-success`}>
        {link.readAt ? "Mark unread" : "Mark read"}
      </button>
      <button onClick={() => onShowDetails(link.id)} className={`${action} hover:text-ink`}>
        Details
      </button>
      <button onClick={() => setIsEditing(true)} className={`${action} hover:text-accent ${onHover}`}>
        Edit
      </button>
      <button onClick={() => onDelete(link.id)} className={`${action} hover:text-danger ${onHover}`}>
        Delete
      </button>
    </>
  );

  // The folder the link is in, as a coloured dot and its name.
  const folder = folders.find((f) => f.id === link.folderId);
  const folderName = folder && (
    <>
      <span aria-hidden="true">·</span>
      <span className="flex min-w-0 items-center gap-1">
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${FOLDER_DOT_CLASS[folder.color ?? "gray"]}`} />
        <span className="truncate">{folder.name}</span>
      </span>
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

  const name = link.title || getDomain(link.url);
  const checkbox = selecting && (
    <input
      type="checkbox"
      checked={selected}
      onChange={() => onToggleSelect?.(link.id)}
      aria-label={`Select ${name}`}
      className="size-5 shrink-0 accent-[#0071e3]"
    />
  );
  function handleCardClick(event: React.MouseEvent) {
    if (!onCardBackground(event)) return;
    if (selecting) onToggleSelect?.(link.id);
    else onShowDetails(link.id);
  }
  const selectedRing = selected ? "ring-2 ring-[#0071e3]" : "";

  // List view: one row. The note, the folder menu and the archive link stay
  // in Cards view (and the details panel).
  if (compact) {
    return (
      // On phones the actions wrap onto their own line under the title.
      <li
        onClick={handleCardClick}
        className={`group flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-hover/50 ${selected ? "bg-hover" : ""}`}
      >
        {checkbox}
        <div className={link.readAt ? "opacity-50 grayscale" : ""}>
          <Favicon url={link.url} size="small" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {titleLink}
            <Badges link={link} now={now} />
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="truncate">{getDomain(link.url)}</span>
            <span aria-hidden="true">·</span>
            {savedAgo}
            {folderName}
            {tagButtons}
          </div>
        </div>
        {!selecting && <div className="-ml-2.5 flex w-full shrink-0 pl-10 sm:ml-0 sm:w-auto sm:pl-0">{actions}</div>}
      </li>
    );
  }

  return (
    <li
      onClick={handleCardClick}
      className={`group glass flex cursor-pointer flex-col justify-between gap-3 overflow-hidden rounded-2xl p-4 transition-[transform,box-shadow] duration-200 motion-safe:animate-rise-in motion-safe:hover:-translate-y-0.5 hover:shadow-lg ${tileSize} ${selectedRing}`}
    >
      {/* The page's picture across the top of the card, edge to edge. */}
      {link.image && <PreviewImage src={link.image} className="-mx-4 -mt-4 mb-1 w-[calc(100%+2rem)] max-w-none self-start" />}
      <div className="flex min-w-0 items-start gap-3">
        {checkbox}
        {/* Read links fade a little: their icon goes grey. */}
        <div className={`shrink-0 ${link.readAt ? "opacity-50 grayscale" : ""}`}>
          <Favicon url={link.url} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {titleLink}
            <Badges link={link} now={now} />
          </div>
          {/* The site, when it was saved and its folder: the full address is in Details. */}
          <p className="flex min-w-0 items-center gap-x-1.5 text-sm text-muted">
            <span className="truncate">{getDomain(link.url)}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{savedAgo}</span>
            {folderName}
          </p>
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
          {tagButtons}
        </div>
      </div>
      {!selecting && <div className="-mx-2.5 -mb-1 flex border-t border-line pt-2">{actions}</div>}
    </li>
  )
}
