"use client";

import { useEffect, useState } from "react";
import LinkForm from "@/components/LinkForm";
import LinkCard from "@/components/LinkCard";
import { createLink, isDuplicate, loadLinks, saveLinks } from "@/lib/links";
import type { Link } from "@/types/link";

export default function Home() {
  const [links, setLinks] = useState<Link[]>([]);
  useEffect(() => {
    // localStorage is only available in the browser, so we need to check if we're running in the browser before accessing it
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLinks(loadLinks());
  }, []);

  function addLink(url: string, title: string) {
    if (isDuplicate(links, url)){
      return "You already saved this link!";
    }

    const updated = [createLink(url, title), ...links];
    setLinks(updated);
    saveLinks(updated);
    return null;
  }


  function deleteLink(id: string) {
    const updated = links.filter((link) => link.id !== id);
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

        <ul className="mt-6 space-y-3">
          {links.length === 0 && (
            <p className="text-slate-400">No links yet. Add your first one above.</p>
          )}
          {links.map((link) => (
            <LinkCard key={link.id} link={link} onDelete={deleteLink} />
          ))}
        </ul>
      </div>
    </main>
  );
}
