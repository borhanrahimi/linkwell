"use client";

import { useCallback, useState } from "react";
import Header from "@/components/Header";
import LinkForm from "@/components/LinkForm";
import LinkCard from "@/components/LinkCard";
import LinkDetails from "@/components/LinkDetails";
import ImportBanner from "@/components/ImportBanner";
import Rediscover from "@/components/Rediscover";
import EmptyBox from "@/components/illustrations/EmptyBox";
import Magnifier from "@/components/illustrations/Magnifier";
import Sidebar from "@/components/Sidebar";
import { useLinkView, type LinkView } from "@/components/useLinkView";
import FolderIconDrawing from "@/components/FolderIcon";
import { FOLDER_DOT_CLASS, FOLDER_TEXT_CLASS } from "@/lib/folders";
import FolderActions from "@/components/FolderActions";
import {
  createFolder,
  moveToFolder,
  removeLink,
  saveLink,
  saveReadStatus,
  saveLinkDetails,
  deleteFolder,
  renameFolder,
  setFolderColor,
  setFolderIcon,
} from "@/app/actions";
import {
  createLink,
  filterByFolder,
  filterByList,
  type SmartList,
  isDuplicate,
  pickRediscover,
  setFolder,
  setReadAt,
  cleanDetails,
  updateDetails,
  parseTags,
  clearFolder,
  filterByTag,
  searchLinks,
  type SortOrder,
  sortLinks,
} from "@/lib/links";
import type {
  Folder,
  FolderColor,
  FolderIcon,
  Link,
  LinkDetailsInput,
} from "@/types/link";

const VIEWS: { id: LinkView; label: string }[] = [
  { id: "cards", label: "Cards" },
  { id: "list", label: "List" },
];

const LIST_TITLES: Record<SmartList, string> = {
  all: "All links",
  unread: "Unread",
  broken: "Broken",
};

type LinkManagerProps = {
  initialLinks: Link[];
  initialFolders?: Folder[];
  now?: Date;
  // The signed-in user, for the top bar. Tests may leave it out: then the
  // save box is shown on its own.
  user?: { name: string; image?: string | null; username?: string | null };
};

export default function LinkManager({
  initialLinks,
  initialFolders = [],
  now,
  user,
}: LinkManagerProps) {
  const [links, setLinks] = useState(initialLinks);
  const [folders, setFolders] = useState(initialFolders);
  // What the list shows: a smart list (all, unread, broken) or one folder,
  // optionally narrowed to one tag and a search.
  const [activeList, setActiveList] = useState<SmartList>("all");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [view, setView] = useLinkView();
  // The link shown in the details panel, if any.
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const detailsLink = links.find((link) => link.id === detailsId);
  // Stable, so the panel's Esc listener isn't re-added on every render.
  const closeDetails = useCallback(() => setDetailsId(null), []);
  const visibleLinks = sortLinks(
    searchLinks(
      filterByTag(
        filterByFolder(filterByList(links, activeList), activeFolder),
        activeTag,
      ),
      query,
    ),
    sortOrder,
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

  // A smart list and a folder are one choice: picking one leaves the other.
  function selectList(list: SmartList) {
    setActiveList(list);
    setActiveFolder(null);
  }

  function selectFolder(folderId: string | null) {
    setActiveFolder(folderId);
    setActiveList("all");
  }

  // Why the list is empty, in words that match what was chosen.
  function emptyMessage() {
    if (query || activeTag) return "No links match your search.";
    if (activeFolder) return "No links in this folder yet.";
    if (activeList === "unread") return "Nothing unread. You're all caught up.";
    if (activeList === "broken") return "No broken links.";
    return "No links match your search.";
  }

  function toggleTag(tag: string) {
    setActiveTag((current) => (current === tag ? null : tag));
  }

  async function deleteLink(id: string) {
    setLinks((current) => current.filter((link) => link.id !== id));
    await removeLink(id);
  }

  async function editDetails(id: string, input: LinkDetailsInput) {
    // Show the change right away, then use what the server actually stored.
    setLinks((current) => updateDetails(current, id, cleanDetails(input)));
    const saved = await saveLinkDetails(id, input);
    setLinks((current) => updateDetails(current, id, saved));
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
    setFolders((current) =>
      current.map((folder) =>
        folder.id === id ? { ...folder, name: name.trim() } : folder,
      ),
    );
    return null;
  }

  // Shows the new colour at once; saving happens in the background.
  async function changeFolderColor(id: string, color: FolderColor) {
    setFolders((current) =>
      current.map((folder) =>
        folder.id === id ? { ...folder, color } : folder,
      ),
    );
    await setFolderColor(id, color);
  }

  async function changeFolderIcon(id: string, icon: FolderIcon | null) {
    setFolders((current) =>
      current.map((folder) =>
        folder.id === id ? { ...folder, icon: icon ?? undefined } : folder,
      ),
    );
    await setFolderIcon(id, icon);
  }

  async function removeFolder(id: string) {
    setFolders((current) => current.filter((folder) => folder.id !== id));
    setLinks((current) => clearFolder(current, id));
    setActiveFolder(null);
    await deleteFolder(id);
  }
  return (
    <>
      {/* The save box lives in the top bar, so it's always at hand. */}
      {user ? (
        <Header user={user}>
          <LinkForm onAdd={addLink} />
        </Header>
      ) : (
        <LinkForm onAdd={addLink} />
      )}
      {/* Visible headings start at the tiles; screen readers still get a page title. */}
      <h1 className="sr-only">Your links</h1>

      <ImportBanner
        onImported={(imported) =>
          setLinks((current) => [...imported, ...current])
        }
      />

      {/* The sidebar on the left (on top, on phones), the list on the right. */}
      {/* With the details panel open, wide screens get a third column for it. */}
      <div
        className={`mt-6 grid grid-cols-1 gap-6 md:grid-cols-[14rem_minmax(0,1fr)] ${
          detailsLink ? "lg:grid-cols-[14rem_minmax(0,1fr)_20rem]" : ""
        }`}
      >
        <Sidebar
          links={links}
          folders={folders}
          activeList={activeList}
          activeFolder={activeFolder}
          activeTag={activeTag}
          onSelectList={selectList}
          onSelectFolder={selectFolder}
          onSelectTag={toggleTag}
          onCreateFolder={addFolder}
          onChecked={setLinks}
        />

        <div className="min-w-0">
          {showRediscover && (
            <Rediscover links={rediscover} now={now} className="mb-6" />
          )}

          {/* What the list is showing: a smart list, or a folder with its own controls. */}
          <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
            {selectedFolder &&
              (selectedFolder.icon ? (
                <FolderIconDrawing
                  name={selectedFolder.icon}
                  className={`size-5 ${FOLDER_TEXT_CLASS[selectedFolder.color ?? "gray"]}`}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className={`size-3 rounded-full ${FOLDER_DOT_CLASS[selectedFolder.color ?? "gray"]}`}
                />
              ))}
            {selectedFolder ? selectedFolder.name : LIST_TITLES[activeList]}
          </h2>
          {selectedFolder && (
            <FolderActions
              key={selectedFolder.id}
              folder={selectedFolder}
              onRename={changeFolderName}
              onRecolor={changeFolderColor}
              onChangeIcon={changeFolderIcon}
              onDelete={removeFolder}
            />
          )}

          {/* The toolbar: search, sort and the view. */}
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search links..."
              aria-label="Search links"
              className="field min-w-0 flex-1 basis-full sm:basis-0"
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
            <div role="group" aria-label="View" className="flex rounded-full bg-hover p-1">
              {VIEWS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  aria-pressed={view === id}
                  className={`rounded-full px-3 py-1 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    view === id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {activeTag && (
            <div className="glass mt-4 flex items-center justify-between gap-4 rounded-full py-1.5 pl-5 pr-1.5 text-sm text-muted">
              <span>Showing links tagged #{activeTag}</span>
              <button
                onClick={() => setActiveTag(null)}
                className="btn-secondary"
              >
                Show all
              </button>
            </div>
          )}
          {links.length === 0 && (
            <div className="mt-6 text-center">
              <EmptyBox className="mx-auto w-48" />
              <p className="mt-2 text-muted">
                No links yet. Add your first one above.
              </p>
            </div>
          )}
          {links.length > 0 && visibleLinks.length === 0 && (
            <div className="mt-6 text-center">
              <Magnifier className="mx-auto w-48" />
              <p className="mt-2 text-muted">{emptyMessage()}</p>
            </div>
          )}

          {visibleLinks.length > 0 && (
            // Cards: a grid. List: one glass panel with a row per link.
            <ul
              aria-label="Links"
              className={
                view === "list"
                  ? "glass mt-4 divide-y divide-line rounded-2xl"
                  : `mt-4 grid grid-flow-dense grid-cols-1 gap-4 ${detailsLink ? "" : "lg:grid-cols-2"}`
              }
            >
              {visibleLinks.map((link) => (
                <LinkCard
                  key={link.id}
                  link={link}
                  activeTag={activeTag}
                  now={now}
                  onDelete={deleteLink}
                  onEditDetails={editDetails}
                  onToggleRead={toggleRead}
                  folders={folders}
                  onMove={moveLink}
                  onTagClick={toggleTag}
                  compact={view === "list"}
                  onShowDetails={setDetailsId}
                />
              ))}
            </ul>
          )}
        </div>

        {detailsLink && (
          <LinkDetails
            key={detailsLink.id}
            link={detailsLink}
            folders={folders}
            now={now}
            onClose={closeDetails}
            onEditDetails={editDetails}
            onToggleRead={toggleRead}
            onMove={moveLink}
            onDelete={(id) => {
              closeDetails();
              deleteLink(id);
            }}
            onTagClick={toggleTag}
          />
        )}
      </div>
    </>
  );
}
