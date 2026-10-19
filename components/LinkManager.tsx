"use client";

import { useState } from "react";
import LinkForm from "@/components/LinkForm";
import LinkCard from "@/components/LinkCard";
import ImportBanner from "@/components/ImportBanner";
import Overview from "@/components/Overview";
import Rediscover from "@/components/Rediscover";
import FolderBar from "@/components/FolderBar";
import FolderActions from "@/components/FolderActions";
import { createFolder, moveToFolder, removeLink, saveLink, saveReadStatus, saveTitle, deleteFolder, renameFolder } from "@/app/actions";
import { createLink, filterByFolder, isDuplicate, pickRediscover, setFolder, setReadAt, updateTitle, parseTags, clearFolder, filterByTag, searchLinks, type SortOrder, sortLinks } from "@/lib/links";
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
  const showRediscover = now !== undefined && rediscover.length > 0;
  const selectedFolder = folders.find((folder) => folder.id === activeFolder);

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
  async function changeFolderName(id: string, name: string) {
    const error = await renameFolder(id, name);
    if (error) {
      return error;
    }
    setFolders((current) => current.map((folder) => (folder.id === id ? { ...folder, name: name.trim() } : folder)));
    return null;
  }

  async function removeFolder(id: string) {
    setFolders((current) => current.filter((folder) => folder.id !== id));
    setLinks((current) => clearFolder(current, id));
    setActiveFolder(null);
    await deleteFolder(id);
  }
  return (
    <>
      <ImportBanner onImported={(imported) => setLinks((current) => [...imported, ...current])} />

      {/* The bento dashboard: one column on phones, three on wider screens. */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <section aria-labelledby="save-heading" className="glass rounded-2xl p-5 md:col-span-2">
          <h2 id="save-heading" className="font-semibold text-ink">
            Save a link
          </h2>
          <LinkForm onAdd={addLink} />
        </section>

        <Overview links={links} onChecked={setLinks} />

        {showRediscover && <Rediscover links={rediscover} now={now} className="md:col-span-2" />}

        {/* Without Rediscover, Folders takes the whole row instead of leaving a gap. */}
        <section
          aria-labelledby="folders-heading"
          className={`glass rounded-2xl p-5 ${showRediscover ? "" : "md:col-span-3"}`}
        >
          <h2 id="folders-heading" className="font-semibold text-ink">
            Folders
          </h2>
          <FolderBar folders={folders} activeFolder={activeFolder} onSelect={setActiveFolder} onCreate={addFolder} />
          {selectedFolder && (
            <FolderActions key={selectedFolder.id} folder={selectedFolder} onRename={changeFolderName} onDelete={removeFolder} />
          )}
        </section>
      </div>

      <div className="mt-6 flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search links..."
          aria-label="Search links"
          className="field min-w-0 flex-1"
        />
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          aria-label="Sort links"
          className="field"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">Title (A–Z)</option>
        </select>
      </div>

      {activeTag && (
        <div className="glass mt-6 flex items-center justify-between gap-4 rounded-full py-1.5 pl-5 pr-1.5 text-sm text-muted">
          <span>Showing links tagged #{activeTag}</span>
          <button onClick={() => setActiveTag(null)} className="btn-secondary">
            Show all
          </button>
        </div>
      )}
      {links.length === 0 && (
        <p className="mt-6 text-muted">No links yet. Add your first one above.</p>
      )}
      {links.length > 0 && visibleLinks.length === 0 && (
        <p className="mt-6 text-muted">
          {activeFolder && !activeTag && !query ? "No links in this folder yet." : "No links match your search."}
        </p>
      )}

      {visibleLinks.length > 0 && (
        // grid-flow-dense lets later cards fill the gaps that wide (broken) cards leave.
        <ul className="mt-4 grid grid-flow-dense grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

