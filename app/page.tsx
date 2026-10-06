"use client";

import { useEffect, useState } from "react";
import LinkForm from "@/components/LinkForm";
import LinkCard from "@/components/LinkCard";
import { createLink, isDuplicate, loadLinks, saveLinks, updateTitle, parseTags, filterByTag } from "@/lib/links";
import type { Link } from "@/types/link";

export default function Home() {
  const [links, setLinks] = useState<Link[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const visibleLinks = filterByTag(links, activeTag);

  useEffect(() => {
    // localStorage is only available in the browser, so we need to check if we're running in the browser before accessing it
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLinks(loadLinks());
  }, []);

  function addLink(url: string, title: string, tags: string) {
    if (isDuplicate(links, url)){
      return "You already saved this link!";
    }

    const updated = [createLink(url, title, parseTags(tags)), ...links];
    setLinks(updated);
    saveLinks(updated);
    return null;
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

        <ul className="mt-6 space-y-3">
          {links.length === 0 && (
            <p className="text-slate-400">No links yet. Add your first one above.</p>
          )}
          {visibleLinks.map((link) => (
          <LinkCard key={link.id} link={link} onDelete={deleteLink} onEditTitle={editTitle} onTagClick={setActiveTag}
            />
          ))}
        </ul>
      </div>
    </main>
  );
}
