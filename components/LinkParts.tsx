"use client";

import { useState } from "react";
import Image from "next/image";
import Checkmark from "@/components/illustrations/Checkmark";
import SnappedChain from "@/components/illustrations/SnappedChain";
import { getDomain, getFaviconUrl, NOTE_MAX_LENGTH, TITLE_MAX_LENGTH, timeAgo } from "@/lib/links";
import type { Link, LinkDetailsInput } from "@/types/link";

// Pieces of a link that the card, the list row and the details panel share,
// so all three always look and behave the same.

const FAVICON_SIZES = {
  small: { tile: "size-7 rounded-lg", image: "size-4" },
  medium: { tile: "size-10 rounded-xl", image: "size-6" },
  large: { tile: "size-14 rounded-2xl", image: "size-8" },
};

// The site's icon in a rounded tile, so square, round and transparent icons
// all line up. The 64px image shown smaller stays sharp on retina screens.
export function Favicon({ url, size = "medium" }: { url: string; size?: keyof typeof FAVICON_SIZES }) {
  const faviconUrl = getFaviconUrl(url);
  const [failed, setFailed] = useState(false);
  const { tile, image } = FAVICON_SIZES[size];
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-line ${tile}`}>
      {faviconUrl && !failed ? (
        <Image
          src={faviconUrl}
          alt=""
          width={32}
          height={32}
          unoptimized
          onError={() => setFailed(true)}
          className={`${image} rounded`}
        />
      ) : (
        // No icon, or it can't load (offline, blocked, gone): the site's first letter.
        <span aria-hidden="true" className="text-sm font-semibold text-slate-600">
          {getDomain(url).charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

// The page's sharing picture, for the card and the details panel. Loaded
// straight from the site (no-referrer: it isn't told which page asked), only
// when it scrolls into view, and simply left out if it can't load.
export function PreviewImage({ src, className = "" }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pictures from any site, not ours to optimise
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`aspect-[1.91/1] bg-hover object-cover ${className}`}
    />
  );
}

// "Read" with a hand-drawn tick, and "Broken" with a snapped chain. Read links
// get a label instead of fading the whole card, because faded text became too
// hard to read.
export function Badges({ link, now }: { link: Link; now?: Date }) {
  return (
    <>
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

// The note as a small sticky note: paper colour, a slight tilt, and a strip of
// tape on top. whitespace-pre-line keeps the line breaks typed in it.
export function StickyNote({ note, clamp = true }: { note: string; clamp?: boolean }) {
  return (
    <div className="relative mt-3 mb-1 w-fit max-w-full -rotate-1 rounded-sm bg-paper px-3 pt-2.5 pb-2 shadow-sm">
      <span aria-hidden="true" className="absolute -top-1.5 left-1/2 h-3 w-10 -translate-x-1/2 rotate-2 bg-tape shadow-sm" />
      <p className={`whitespace-pre-line text-sm text-ink ${clamp ? "line-clamp-3" : ""}`}>{note}</p>
    </div>
  );
}

// The Edit form: title, tags and note, filled from the link.
export function EditForm({
  link,
  onSave,
  onCancel,
}: {
  link: Link;
  onSave: (input: LinkDetailsInput) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<LinkDetailsInput>({
    title: link.title || "",
    tags: (link.tags ?? []).join(", "),
    note: link.note || "",
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    onSave(draft);
  }

  return (
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
        <button type="button" onClick={onCancel} className="btn-quiet">
          Cancel
        </button>
      </div>
    </form>
  );
}
