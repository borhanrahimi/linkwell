"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import Header from "@/components/Header";
import LinkForm from "@/components/LinkForm";
import LinkCard from "@/components/LinkCard";
import LinkDetails from "@/components/LinkDetails";
import ImportBanner from "@/components/ImportBanner";
import Rediscover from "@/components/Rediscover";
import AllWell from "@/components/illustrations/AllWell";
import CaughtUp from "@/components/illustrations/CaughtUp";
import EmptyBox from "@/components/illustrations/EmptyBox";
import EmptyFolder from "@/components/illustrations/EmptyFolder";
import Magnifier from "@/components/illustrations/Magnifier";
import Sidebar from "@/components/Sidebar";
import { useLinkView, type LinkView } from "@/components/useLinkView";
import { useAddressState } from "@/components/useAddressState";
import FolderIconDrawing from "@/components/FolderIcon";
import { FOLDER_DOT_CLASS, FOLDER_TEXT_CLASS } from "@/lib/folders";
import FolderActions from "@/components/FolderActions";
import AddLinksSheet from "@/components/AddLinksSheet";
import BottomBar from "@/components/BottomBar";
import Sheet from "@/components/Sheet";
import { useLinkActions } from "@/components/LinkActions";
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
  // The demo's right side of the top bar, instead of an account.
  topBarEnd?: ReactNode;
  // The address's query (like "list=unread") the server rendered with.
  initialSearch?: string;
};

export default function LinkManager({
  initialLinks,
  initialFolders = [],
  now,
  user,
  topBarEnd,
  initialSearch,
}: LinkManagerProps) {
  // The server's actions, or the demo's stand-ins (see LinkActions).
  const {
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
    moveLinksToFolder,
    markLinksRead,
  } = useLinkActions();
  const [links, setLinks] = useState(initialLinks);
  const [folders, setFolders] = useState(initialFolders);
  // What the list shows: a smart list (all, unread, broken) or one folder,
  // optionally narrowed to one tag and a search.
  // The chosen list, folder, tag and view live in the address (see useAddressState).
  const [address, updateAddress] = useAddressState(initialSearch);
  const activeList = address.list;
  // A folder that no longer exists (deleted, or an old bookmark) means no folder.
  const activeFolder = folders.some((folder) => folder.id === address.folder) ? address.folder : null;
  const activeTag = address.tag;
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  // The address can choose the view; otherwise the device remembers its own.
  const [storedView, storeView] = useLinkView();
  const view = address.view ?? storedView;
  function setView(next: LinkView) {
    storeView(next);
    updateAddress({ view: next });
  }
  // The link shown in the details panel, if any.
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const detailsLink = links.find((link) => link.id === detailsId);
  // Stable, so the panel's Esc listener isn't re-added on every render.
  const closeDetails = useCallback(() => setDetailsId(null), []);
  // "Add links" to the open folder, like filling a playlist.
  const [addingLinks, setAddingLinks] = useState(false);
  const closeAddLinks = useCallback(() => setAddingLinks(false), []);
  // Phones: the save box opens in a sheet from the bottom bar's +.
  const [savingOnPhone, setSavingOnPhone] = useState(false);
  const closeSaveSheet = useCallback(() => setSavingOnPhone(false), []);
  // Select mode: tick several links, then move them or mark them read.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Phones: whether the sidebar is open as a drawer. Closing it puts focus
  // back on the Lists button that opened it.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuButton.current?.focus();
  }, []);
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
  // Up to ten old links; the banner shows one at a time.
  const rediscover = now ? pickRediscover(links, now, 10) : [];
  const showRediscover = now !== undefined && rediscover.length > 0;
  const selectedFolder = folders.find((folder) => folder.id === activeFolder);

  async function addLink(url: string, title: string, tags: string, folderId = "") {
    if (isDuplicate(links, url)) {
      return "You already saved this link!";
    }

    const link = { ...createLink(url, title, parseTags(tags)), folderId: folderId || undefined };
    const result = await saveLink(link);
    if (typeof result === "string") {
      return result;
    }

    setLinks((current) => [result, ...current]);
    return null;
  }

  // A smart list and a folder are one choice: picking one leaves the other.
  // Picking something in the phone drawer also closes it, to show the list.
  function selectList(list: SmartList) {
    updateAddress({ list, folder: null });
    if (menuOpen) closeMenu();
  }

  function selectFolder(folderId: string | null) {
    updateAddress({ folder: folderId, list: "all" });
    if (menuOpen) closeMenu();
  }

  // Why the list is empty, in words (and a drawing) that match what was chosen.
  function emptyState() {
    const drawing = "mx-auto w-48";
    if (query || activeTag)
      return {
        text: "No links match your search.",
        drawing: <Magnifier className={drawing} />,
      };
    if (activeFolder)
      return {
        text: "No links in this folder yet.",
        drawing: <EmptyFolder className={drawing} />,
      };
    if (activeList === "unread")
      return {
        text: "Nothing unread. You're all caught up.",
        drawing: <CaughtUp className={drawing} />,
      };
    if (activeList === "broken")
      return {
        text: "No broken links. Every link still works.",
        drawing: <AllWell className={drawing} />,
      };
    return {
      text: "No links match your search.",
      drawing: <Magnifier className={drawing} />,
    };
  }

  function toggleTag(tag: string) {
    updateAddress({ tag: activeTag === tag ? null : tag });
    if (menuOpen) closeMenu();
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

  // Several links into one folder (or out of folders, with null), at once.
  async function moveMany(ids: string[], folderId: string | null) {
    if (ids.length === 0) return;
    const chosen = new Set(ids);
    setLinks((current) =>
      current.map((link) => (chosen.has(link.id) ? { ...link, folderId: folderId ?? undefined } : link))
    );
    await moveLinksToFolder(ids, folderId);
  }

  async function markManyRead(ids: string[], read: boolean) {
    if (ids.length === 0) return;
    const chosen = new Set(ids);
    const readAt = read ? new Date().toISOString() : undefined;
    setLinks((current) => current.map((link) => (chosen.has(link.id) ? { ...link, readAt } : link)));
    await markLinksRead(ids, read);
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  async function moveLink(id: string, folderId: string | undefined) {
    setLinks((current) => setFolder(current, id, folderId));
    await moveToFolder(id, folderId ?? null);
  }

  // Makes a folder; returns it (for the save box's folder menu) or an error.
  async function makeFolder(name: string) {
    const result = await createFolder(name);
    if (typeof result !== "string") {
      setFolders((current) => [...current, result]);
    }
    return result;
  }

  async function addFolder(name: string) {
    const result = await makeFolder(name);
    return typeof result === "string" ? result : null;
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
    // The folder is gone, so the address shouldn't point at it (nor offer it on Back).
    updateAddress({ folder: null }, { replace: true });
    await deleteFolder(id);
  }
  return (
    <>
      {/* The save box lives in the top bar, so it's always at hand. */}
      {user || topBarEnd ? (
        <Header user={user} end={topBarEnd} hideMiddleOnPhones>
          <LinkForm onAdd={addLink} folders={folders} currentFolder={activeFolder} onCreateFolder={makeFolder} />
        </Header>
      ) : (
        <LinkForm onAdd={addLink} folders={folders} currentFolder={activeFolder} onCreateFolder={makeFolder} />
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
          open={menuOpen}
          onClose={closeMenu}
        />

        <div className="min-w-0">
          {showRediscover && (
            <Rediscover links={rediscover} now={now} className="mb-6" />
          )}

          {/* What the list is showing: a smart list, or a folder with its own controls. */}
          {/* On phones, the Lists button next to it opens the sidebar as a drawer. */}
          {/* A folder's pencil sits right after its name; its edit panel wraps below. */}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex min-w-0 items-center gap-2 text-xl font-semibold text-ink">
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
              <span className="truncate">
                {selectedFolder ? selectedFolder.name : LIST_TITLES[activeList]}
              </span>
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
            {/* How many links the list is showing, with search and tag applied. */}
            <span className="ml-auto shrink-0 text-sm text-muted">
              {visibleLinks.length === 1 ? "1 link" : `${visibleLinks.length} links`}
            </span>
            {selectedFolder && (
              <button onClick={() => setAddingLinks(true)} className="btn-secondary flex items-center gap-1.5">
                <span aria-hidden="true" className="text-base leading-none">+</span>
                Add links
              </button>
            )}
          </div>
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
            <div
              role="group"
              aria-label="View"
              className="flex rounded-full bg-hover p-1"
            >
              {VIEWS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  aria-pressed={view === id}
                  className={`rounded-full px-3 py-1 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    view === id
                      ? "bg-surface text-ink shadow-sm"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {links.length > 0 && (
              <button
                onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
                aria-pressed={selecting}
                className="btn-secondary"
              >
                Select
              </button>
            )}
          </div>

          {activeTag && (
            <div className="glass mt-4 flex items-center justify-between gap-4 rounded-full py-1.5 pl-5 pr-1.5 text-sm text-muted">
              <span>Showing links tagged #{activeTag}</span>
              <button
                onClick={() => updateAddress({ tag: null })}
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
              {emptyState().drawing}
              <p className="mt-2 text-muted">{emptyState().text}</p>
              {/* An empty folder is a playlist waiting to be filled. */}
              {selectedFolder && !query && !activeTag && (
                <button onClick={() => setAddingLinks(true)} className="btn-primary mt-4">
                  Add links
                </button>
              )}
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
                  onTagClick={toggleTag}
                  compact={view === "list"}
                  onShowDetails={setDetailsId}
                  selecting={selecting}
                  selected={selected.has(link.id)}
                  onToggleSelect={toggleSelected}
                />
              ))}
            </ul>
          )}
        </div>

        {addingLinks && selectedFolder && (
          <AddLinksSheet
            folderName={selectedFolder.name}
            links={links.filter((link) => link.folderId !== selectedFolder.id)}
            onAdd={(ids) => {
              closeAddLinks();
              moveMany(ids, selectedFolder.id);
            }}
            onClose={closeAddLinks}
          />
        )}

        {/* Select mode's actions, floating at the bottom while links are ticked. */}
        {selecting && (
          <div
            role="toolbar"
            aria-label="Selected links"
            className="glass-bar fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 mx-auto grid max-w-xl grid-cols-[1fr_auto] items-center gap-2 rounded-3xl px-4 py-3 motion-safe:animate-rise-in md:bottom-6 md:flex"
          >
            <span className="text-sm font-medium text-ink md:mr-auto" aria-live="polite">
              {selected.size === 0 ? "Tick links to select them" : `${selected.size} selected`}
            </span>
            <button onClick={stopSelecting} className="btn-primary md:order-last">
              Done
            </button>
            {/* On phones the actions get a row of their own, under the count. */}
            <div className="col-span-2 flex gap-2">
              <select
                value=""
                onChange={(e) => {
                  const target = e.target.value;
                  if (!target) return;
                  moveMany([...selected], target === "none" ? null : target);
                  stopSelecting();
                }}
                disabled={selected.size === 0}
                aria-label="Move selected links to folder"
                className="field min-w-0 flex-1 py-1.5 disabled:opacity-50 md:flex-none"
              >
                <option value="">Move to…</option>
                <option value="none">No folder</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  markManyRead([...selected], true);
                  stopSelecting();
                }}
                disabled={selected.size === 0}
                className="btn-secondary"
              >
                Mark read
              </button>
            </div>
          </div>
        )}

        {savingOnPhone && (
          <Sheet title="Save a link" onClose={closeSaveSheet} focusTitle={false}>
            <LinkForm
              autoFocus
              onAdd={async (...args) => {
                const message = await addLink(...args);
                if (!message) closeSaveSheet();
                return message;
              }}
              folders={folders}
              currentFolder={activeFolder}
              onCreateFolder={makeFolder}
            />
          </Sheet>
        )}

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

      <BottomBar
        activeList={activeList}
        inFolder={Boolean(activeFolder)}
        onSelectList={selectList}
        onSave={() => setSavingOnPhone(true)}
        onOpenLists={() => setMenuOpen(true)}
        listsOpen={menuOpen}
        listsButton={menuButton}
      />
      {/* Room under the last link, so the bottom bar never covers it. */}
      <div aria-hidden="true" className="h-24 md:hidden" />
    </>
  );
}
