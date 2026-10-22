"use client";

import { useState } from "react";
import Sheet from "@/components/Sheet";
import { Favicon } from "@/components/LinkParts";
import { getDomain, searchLinks } from "@/lib/links";
import type { Link } from "@/types/link";

type AddLinksSheetProps = {
  folderName: string;
  // The links that aren't in this folder yet.
  links: Link[];
  onAdd: (ids: string[]) => void;
  onClose: () => void;
};

// Filling a folder like a playlist: tick the links to put in it (search to
// find them), then "Add 3 links". Links already in another folder move here.
export default function AddLinksSheet({ folderName, links, onAdd, onClose }: AddLinksSheetProps) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const shown = searchLinks(links, query);

  function toggle(id: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const count = chosen.size;
  return (
    <Sheet
      title={`Add links to ${folderName}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-quiet">
            Cancel
          </button>
          <button onClick={() => onAdd([...chosen])} disabled={count === 0} className="btn-primary disabled:opacity-50">
            {count === 0 ? "Add links" : count === 1 ? "Add 1 link" : `Add ${count} links`}
          </button>
        </>
      }
    >
      {links.length === 0 ? (
        <p className="py-6 text-center text-muted">Every link you have is already in this folder.</p>
      ) : (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search your links"
            placeholder="Search your links..."
            className="field w-full"
          />
          <ul aria-label="Links to add" className="mt-3 divide-y divide-line">
            {shown.map((link) => (
              <li key={link.id}>
                <label className="flex cursor-pointer items-center gap-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={chosen.has(link.id)}
                    onChange={() => toggle(link.id)}
                    className="size-5 shrink-0 accent-[#0071e3]"
                  />
                  <Favicon url={link.url} size="small" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{link.title || getDomain(link.url)}</span>
                    <span className="block truncate text-sm text-muted">{getDomain(link.url)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p className="py-6 text-center text-muted">No links match your search.</p>}
        </>
      )}
    </Sheet>
  );
}
