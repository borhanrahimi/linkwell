"use client";

import { useEffect, useRef, useState } from "react";
import { Badges, EditForm, Favicon, PreviewImage, StickyNote } from "@/components/LinkParts";
import { useSwipeToClose } from "@/components/useSwipeToClose";
import { getArchiveUrl, getDomain, timeAgo } from "@/lib/links";
import type { Folder, Link, LinkDetailsInput } from "@/types/link";

type LinkDetailsProps = {
  link: Link;
  folders: Folder[];
  now?: Date;
  onClose: () => void;
  onEditDetails: (id: string, input: LinkDetailsInput) => void;
  onToggleRead: (id: string) => void;
  onMove: (id: string, folderId: string | undefined) => void;
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
};

function fullDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Everything about one link, beside the list. On wide screens it's a column
// that stays in view while the list scrolls; on smaller ones it's a sheet
// sliding up from the bottom over a dimmed page, with a handle to swipe it
// away. Close it with the button, Esc, a tap outside, or the swipe.
export default function LinkDetails({
  link,
  folders,
  now,
  onClose,
  onEditDetails,
  onToggleRead,
  onMove,
  onDelete,
  onTagClick,
}: LinkDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { sheet, handle } = useSwipeToClose<HTMLElement>(onClose);

  // Move keyboard (and screen reader) focus into the panel when it opens or
  // shows another link, so people know something opened.
  useEffect(() => {
    headingRef.current?.focus();
  }, [link.id]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const facts: { label: string; value: React.ReactNode }[] = [
    {
      label: "Saved",
      value: `${fullDate(link.createdAt)} (${timeAgo(link.createdAt, now)})`,
    },
    { label: "Read", value: link.readAt ? fullDate(link.readAt) : "Not yet" },
    {
      label: "Last checked",
      value: link.checkedAt
        ? `${fullDate(link.checkedAt)}: ${link.status === "broken" ? "broken" : "working"}`
        : "Not checked yet",
    },
  ];

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 motion-safe:animate-fade-in lg:hidden"
      />
      <aside
        ref={sheet}
        aria-labelledby="details-heading"
        className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-surface shadow-2xl max-lg:motion-safe:animate-sheet-up lg:sticky lg:inset-auto lg:top-24 lg:z-auto lg:max-h-[calc(100vh-7rem)] lg:self-start lg:rounded-none lg:bg-transparent lg:shadow-none"
      >
        {/* The handle: phones and tablets only. */}
        <div
          aria-hidden="true"
          {...handle}
          className="sticky top-0 z-10 flex cursor-grab touch-none justify-center bg-surface pb-1 pt-3 lg:hidden"
        >
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </div>
        <div className="p-5 pt-2 lg:glass lg:rounded-2xl lg:pt-5">
          <div className="flex items-start justify-between gap-3">
            <Favicon url={link.url} size="large" />
            <button onClick={onClose} className="btn-quiet">
              Close
            </button>
          </div>

          {/* tabIndex -1: focusable from code (when the panel opens), not with Tab. */}
          {link.image && <PreviewImage src={link.image} className="mt-4 w-full rounded-xl" />}
          <h2
            id="details-heading"
            ref={headingRef}
            tabIndex={-1}
            className="mt-4 text-lg font-semibold text-ink focus:outline-none"
          >
            {link.title || getDomain(link.url)}
          </h2>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block break-all text-sm text-accent hover:underline"
          >
            {link.url}
          </a>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badges link={link} now={now} />
          </div>
          {link.status === "broken" && (
            <a
              href={getArchiveUrl(link.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-sm text-warning hover:underline"
            >
              View archived copy
            </a>
          )}

          {isEditing ? (
            <div className="mt-4">
              <EditForm
                link={link}
                onSave={(input) => {
                  onEditDetails(link.id, input);
                  setIsEditing(false);
                }}
                onCancel={() => setIsEditing(false)}
              />
            </div>
          ) : (
            <>
              {link.note && <StickyNote note={link.note} clamp={false} />}

              <dl className="mt-4 space-y-2 text-sm">
                {facts.map((fact) => (
                  <div key={fact.label} className="flex justify-between gap-4">
                    <dt className="text-muted">{fact.label}</dt>
                    <dd className="text-right text-ink">{fact.value}</dd>
                  </div>
                ))}
              </dl>

              <label className="mt-4 flex items-center justify-between gap-4 text-sm text-muted">
                Folder
                <select
                  value={link.folderId ?? ""}
                  onChange={(e) => onMove(link.id, e.target.value || undefined)}
                  className="field max-w-[60%] py-1 text-sm"
                >
                  <option value="">No folder</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>

              {link.tags && link.tags.length > 0 && (
                <ul
                  aria-label="Tags of this link"
                  className="mt-4 flex flex-wrap gap-1"
                >
                  {link.tags.map((tag) => (
                    <li key={tag}>
                      <button
                        onClick={() => onTagClick(tag)}
                        className="rounded-full bg-hover px-2 py-0.5 text-xs text-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        #{tag}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                <button
                  onClick={() => onToggleRead(link.id)}
                  className="btn-secondary"
                >
                  {link.readAt ? "Mark unread" : "Mark read"}
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn-secondary"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(link.id)}
                  className="btn-danger"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
