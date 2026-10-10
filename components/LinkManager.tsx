"use client";

import { useState } from "react";
import LinkForm from "@/components/LinkForm";
import LinkCard from "@/components/LinkCard";
import ImportBanner from "@/components/ImportBanner";
import CheckLinksButton from "@/components/CheckLinksButton";
import Rediscover from "@/components/Rediscover";
import FolderBar from "@/components/FolderBar";
import { createFolder, moveToFolder, removeLink, saveLink, saveReadStatus, saveTitle } from "@/app/actions";
import { createLink, filterByFolder, isDuplicate, pickRediscover, setFolder, setReadAt, updateTitle, parseTags, filterByTag, searchLinks, type SortOrder, sortLinks } from "@/lib/links";
import type { Folder, Link } from "@/types/link";

type LinkManagerProps = {
  initialLinks: Link[];
  initialFolders?: Folder[];
  now?: Date;
};

export default function LinkManager({ initialLinks, initialFolders = [], now }: LinkManagerProps) {
  const [links, setLinks] = useState(initialLinks);
  const [folders, setFolders] = useState(initialFolders);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const visibleLinks = sortLinks(
    searchLinks(filterByTag(filterByFolder(links, activeFolder), activeTag), query),
    sortOrder
  );
  const rediscover = now ? pickRediscover(links, now) : [];

  async function addLink(url: string, title: string, tags: string) {
    if (isDuplicate(links, url)) {
      return "You already saved this link!";
    }

    const link = createLink(url, title, parseTags(tags));
    const result = await saveLink(link);
    if (typeof result === "string") {
      return result;
    }

    setLinks((current) => [result, ...current]);
    return null;
  }

  function toggleTag(tag: string) {
    setActiveTag((current) => (current === tag ? null : tag));
  }

  async function deleteLink(id: string) {
    setLinks((current) => current.filter((link) => link.id !== id));
    await removeLink(id);
  }

  async function editTitle(id: string, title: string) {
    setLinks((current) => updateTitle(current, id, title));
    await saveTitle(id, title);
  }
  async function toggleRead(id: string) {
    const link = links.find((l) => l.id === id);
    if (!link) {
      return;
    }
    const readAt = link.readAt ? undefined : new Date().toISOString();
    setLinks((current) => setReadAt(current, id, readAt));
    await saveReadStatus(id, !link.readAt);
  }

  async function moveLink(id: string, folderId: string | undefined) {
    setLinks((current) => setFolder(current, id, folderId));
    await moveToFolder(id, folderId ?? null);
  }

  async function addFolder(name: string) {
    const result = await createFolder(name);
    if (typeof result === "string") {
      return result;
    }
    setFolders((current) => [...current, result]);
    return null;
  }

  return (
    <>
      <ImportBanner onImported={(imported) => setLinks((current) => [...imported, ...current])} />

      <LinkForm onAdd={addLink} />

      {now && <Rediscover links={rediscover} now={now} />}


      <FolderBar folders={folders} activeFolder={activeFolder} onSelect={setActiveFolder} onCreate={addFolder} />

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

      {links.length > 0 && <CheckLinksButton onChecked={setLinks} />}
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
        <p className="mt-6 text-slate-400">
          {activeFolder && !activeTag && !query ? "No links in this folder yet." : "No links match your search."}
        </p>
      )}

      {visibleLinks.length > 0 && (
        <ul className="mt-6 space-y-3">
          {visibleLinks.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              activeTag={activeTag}
              now={now}
              onDelete={deleteLink}
              onEditTitle={editTitle}
              onToggleRead={toggleRead}
              folders={folders}
              onMove={moveLink}
              onTagClick={toggleTag}
            />
          ))}
        </ul>
      )}
    </>
  );
}
