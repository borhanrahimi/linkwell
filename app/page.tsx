"use client";

import { useEffect, useState } from "react";
import LinkForm from "@/components/LinkForm";
import LinkCard from "@/components/LinkCard";
import { createLink, isDuplicate, loadLinks, saveLinks, updateTitle, parseTags, filterByTag, searchLinks, type SortOrder, sortLinks } from "@/lib/links";
import type { Link } from "@/types/link";

export default function Home() {
  const [links, setLinks] = useState<Link[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const visibleLinks = sortLinks(searchLinks(filterByTag(links, activeTag), query), sortOrder);


  useEffect(() => {
    // localStorage is only available in the browser, so we need to check if we're running in the browser before accessing it
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLinks(loadLinks());
  }, []);

  function addLink(url: string, title: string, tags: string) {
    if (isDuplicate(links, url)) {
      return "You already saved this link!";
    }

    const updated = [createLink(url, title, parseTags(tags)), ...links];
    setLinks(updated);
    saveLinks(updated);
    return null;
  }

  function toggleTag(tag: string) {
    setActiveTag((current) => (current === tag ? null : tag));
  }
  function deleteLink(id: string) {
    const updated = links.filter((link) => link.id !== id);
    setLinks(updated);
    saveLinks(updated);
  }

  function editTitle(id: string, title: string) {
    const updated = updateTitle(links, id, title);
    setLinks(updated);
    saveLinks(updated);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold text-slate-900">Linkwell</h1>
        <p className="mt-1 text-slate-500">
          Save links. Keep them alive. Actually come back to them.
        </p>

        <LinkForm onAdd={addLink} />

        <div className="mt-6 flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search links..."
            aria-label="Search links"
            className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            aria-label="Sort links"
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title (A–Z)</option>
          </select>
        </div>
        {activeTag && (
          <div className="mt-6 flex items-center justify-between rounded-lg bg-blue-50 px-4 py-2 text-blue-800">
            <span>Showing links tagged #{activeTag}</span>
            <button
              onClick={() => setActiveTag(null)}
              className="rounded bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1">
              Show all
            </button>
          </div>
        )}
        {links.length === 0 && (
          <p className="mt-6 text-slate-400">No links yet. Add your first one above.</p>
        )}
        {links.length > 0 && visibleLinks.length === 0 && (
          <p className="mt-6 text-slate-400">No links match your search.</p>
        )}

        {visibleLinks.length > 0 && (
          <ul className="mt-6 space-y-3">
            {visibleLinks.map((link) => (
              <LinkCard
                key={link.id}
                link={link}
                activeTag={activeTag}
                onDelete={deleteLink}
                onEditTitle={editTitle}
                onTagClick={toggleTag}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
