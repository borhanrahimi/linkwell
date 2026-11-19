"use client";

import { useEffect, useState } from "react";
import Sheet from "@/components/Sheet";
import { Favicon } from "@/components/LinkParts";
import { getDomain } from "@/lib/links";
import { matchesSearch, PAGE_SIZE, type LinkPage } from "@/lib/linkQuery";
import type { Link } from "@/types/link";

type AddLinksSheetProps = {
  folderName: string;
  // The links that aren't in this folder yet (the demo and tests have them all)...
  links?: Link[];
  // ...or, signed in, a way to ask the server for the first page of them
  // that a search finds.
  find?: (search: string) => Promise<LinkPage>;
  onAdd: (ids: string[]) => void;
  onClose: () => void;
};

// Filling a folder like a playlist: tick the links to put in it (search to
// find them), then "Add 3 links". Links already in another folder move here.
export default function AddLinksSheet({ folderName, links, find, onAdd, onClose }: AddLinksSheetProps) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  // The server's answer, and the search it answered.
  const [found, setFound] = useState<{ search: string; page: LinkPage } | null>(null);
  useEffect(() => {
    if (!find) return;
    // Asked once typing stops for a moment; an answer to an older search is dropped.
    let current = true;
    const timer = setTimeout(
      () =>
        find(query.trim()).then(
          (page) => current && setFound({ search: query.trim(), page }),
          () => {}
        ),
      found ? 250 : 0
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
    // found only decides the wait, so it isn't a reason to ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find, query]);

  const local = links ? links.filter((link) => matchesSearch(link, query)) : [];
  const shown = links ? local.slice(0, PAGE_SIZE * 4) : (found?.page.links ?? []);
  // How many the search finds (only the first ones are listed).
  const total = links ? local.length : (found?.page.total ?? 0);
  const nothingToAdd = links ? links.length === 0 : found?.search === "" && found.page.total === 0;

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
      {nothingToAdd ? (
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
          {!links && !found && <p role="status" className="py-6 text-center text-muted">Loading your links…</p>}
          {(links || found) && shown.length === 0 && <p className="py-6 text-center text-muted">No links match your search.</p>}
          {total > shown.length && (
            <p className="py-3 text-center text-sm text-muted">
              Showing {shown.length} of {total.toLocaleString("en")}. Search to find the others.
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}
