"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import Header from "@/components/Header";
import LinkForm from "@/components/LinkForm";
import LinkCard from "@/components/LinkCard";
import LinkDetails from "@/components/LinkDetails";
import ImportBanner from "@/components/ImportBanner";
import HomeView from "@/components/HomeView";
import AllWell from "@/components/illustrations/AllWell";
import CaughtUp from "@/components/illustrations/CaughtUp";
import EmptyBox from "@/components/illustrations/EmptyBox";
import EmptyFolder from "@/components/illustrations/EmptyFolder";
import Magnifier from "@/components/illustrations/Magnifier";
import Sidebar from "@/components/Sidebar";
import { useLinkView, type LinkView } from "@/components/useLinkView";
import { useAddressState } from "@/components/useAddressState";
import FolderIconDrawing from "@/components/FolderIcon";
import { DRAG_SOURCE_CLASS, DragProvider, useDrag, type DragItem, type DropSpot } from "@/components/DragAndDrop";
import {
  childFolders,
  countInside,
  flattenTree,
  folderAndInside,
  folderPath,
  FOLDER_DOT_CLASS,
  FOLDER_TEXT_CLASS,
  indentedName,
  nextPosition,
  placeFolder,
  placeOf,
  renamesMovingUp,
} from "@/lib/folders";
import FolderActions from "@/components/FolderActions";
import AddLinksSheet from "@/components/AddLinksSheet";
import BottomBar, { type Tab } from "@/components/BottomBar";
import FolderBar from "@/components/FolderBar";
import Sheet from "@/components/Sheet";
import TrashView from "@/components/TrashView";
import UndoToast, { type Toast } from "@/components/UndoToast";
import { useLinkActions } from "@/components/LinkActions";
import type { SaveProblem } from "@/components/LinkForm";
import {
  BULK_MAX,
  createLink,
  type SmartList,
  isDuplicate,
  normalizeUrl,
  setReadAt,
  cleanDetails,
  updateDetails,
  parseTags,
  getDomain,
  type SortOrder,
} from "@/lib/links";
import { addNewLinks, liveSummary, matchesQuery, shownQuery, summarize, withNewLink, type LinkPage, type LinkSummary } from "@/lib/linkQuery";
import { SERVER_SOURCE, type LinkSource } from "@/lib/linkSource";
import { useLinkList } from "@/components/useLinkList";
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
  // Home with a tag chosen shows every link with that tag.
  home: "All links",
  all: "All links",
  unsorted: "Not in a folder",
  folders: "Folders",
  unread: "Unread",
  broken: "Broken",
  trash: "Trash",
};

type LinkManagerProps = {
  // Every link (the demo and tests), or, with initialSummary, the links the
  // server sent with the page (Home's and the first page of the list).
  initialLinks: Link[];
  // Signed in (v2.5): the counts, tags and Home's links, worked out by the
  // database. With it, lists load a page at a time through `source`.
  initialSummary?: LinkSummary;
  // The first page of the list in the address, if one is shown.
  initialPage?: { key: string; page: LinkPage } | null;
  // Where pages come from (tests pass a fake).
  source?: LinkSource;
  initialFolders?: Folder[];
  // What's in the Trash when the page opens.
  initialTrash?: { links: Link[]; folders: Folder[] };
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
  initialSummary,
  initialPage,
  source: givenSource = SERVER_SOURCE,
  initialFolders = [],
  initialTrash = { links: [], folders: [] },
  now,
  user,
  topBarEnd,
  initialSearch,
}: LinkManagerProps) {
  // Changes still being saved. Asking the server for a list or the counts
  // waits for them first, so the answer includes them (a link restored just
  // before opening All links is in it).
  const [saving] = useState(() => new Set<Promise<unknown>>());
  const source = useMemo(() => afterSaving(givenSource, saving), [givenSource, saving]);
  // The server's actions, or the demo's stand-ins (see LinkActions), each
  // one remembered in `saving` until it's done.
  const givenActions = useLinkActions();
  const actions = useMemo(() => remembered(givenActions, saving), [givenActions, saving]);
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
    removeLinks,
    restoreLinks,
    restoreFolder,
    deleteForever,
    emptyTrash,
    setReadDates,
    moveFolder,
    setFolderPinned,
  } = actions;
  const [links, setLinks] = useState(initialLinks);
  const [folders, setFolders] = useState(initialFolders);
  // The folders as they are now, for Undo: its callback was made a render ago.
  const latestFolders = useRef(folders);
  useEffect(() => {
    latestFolders.current = folders;
  });
  const [trash, setTrash] = useState(initialTrash);
  // Links deleted on this page. An answer the server sent before a delete
  // reached it still has them, and mustn't bring them back. Restoring them
  // takes them off again.
  const [deleted] = useState(() => new Set<string>());
  // Links that came from the server join the ones the page has (see addNewLinks).
  const learn = useCallback(
    (incoming: Link[]) => setLinks((current) => addNewLinks(current, incoming.filter((link) => !deleted.has(link.id)))),
    [deleted]
  );
  // The small message after a change, with Undo (see UndoToast).
  const [toast, setToast] = useState<Toast | null>(null);
  const toastCount = useRef(0);
  const closeToast = useCallback(() => setToast(null), []);
  function showToast(message: string, onUndo?: () => void) {
    toastCount.current += 1;
    setToast({ id: toastCount.current, message, onUndo });
  }
  // What the list shows: a smart list (all, unread, broken) or one folder,
  // optionally narrowed to one tag and a search.
  // The chosen list, folder, tag and view live in the address (see useAddressState).
  const [address, updateAddress] = useAddressState(initialSearch);
  const activeList = address.list;
  // A folder that no longer exists (deleted, or an old bookmark) means no folder.
  const activeFolder = folders.some((folder) => folder.id === address.folder) ? address.folder : null;
  const activeTag = address.tag;
  // The search the list shows. The box keeps what's typed itself (see
  // SearchBox), so a key press only redraws the box, not every card.
  const [query, setQuery] = useState("");
  // In a folder: also show the links in the folders inside it.
  const [withInside, setWithInside] = useState(false);
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
  // Signed in, the Add links sheet asks the server for the links not in the
  // open folder. Stable, so the sheet only asks again when the search changes.
  const addingTo = addingLinks ? address.folder : null;
  const findLinksToAdd = useCallback(
    async (search: string) => {
      const page = await source.page({ list: "all", folderIds: null, notInFolder: addingTo, tag: null, search, sort: "newest" }, null);
      learn(page.links);
      return page;
    },
    [source, addingTo, learn]
  );
  // Phones: the save box opens in a sheet from the bottom bar's +.
  // The account page's + comes here as /?save=1, to open the sheet at once.
  const [savingOnPhone, setSavingOnPhone] = useState(() => new URLSearchParams(initialSearch).has("save"));
  // ...and save=1 then leaves the address, so a refresh doesn't open it again.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("save")) return;
    params.delete("save");
    window.history.replaceState(null, "", params.size ? `?${params}` : window.location.pathname);
  }, []);
  const closeSaveSheet = useCallback(() => setSavingOnPhone(false), []);
  // Select mode: tick several links, then move them or mark them read.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Signed in, the server sent a summary and lists come a page at a time;
  // otherwise (the demo, tests) every link is here and everything is worked
  // out from them (see lib/linkQuery.ts).
  const server = initialSummary !== undefined;
  const [serverSummary, setServerSummary] = useState(initialSummary);
  const summary = serverSummary ? liveSummary(serverSummary, links) : summarize(links, now);
  // The list on screen (null on Home, Folders and the Trash).
  const listQuery = shownQuery(folders, address, { withInside, search: query, sort: sortOrder });
  const list = useLinkList({ server, query: listQuery, links, learn, source, initial: initialPage });
  const visibleLinks = list.links;
  // Up to ten old links; the banner shows one at a time.
  const rediscover = summary.rediscoverLinks;
  // Home is the first screen; a folder or a tag shows a list instead.
  const showHome = activeList === "home" && !activeFolder && !activeTag;
  // The phone's tab for what's showing: a folder is in Folders.
  const phoneTab: Tab | null =
    activeFolder || activeList === "folders" ? "folders" : showHome ? "home" : activeList === "unread" ? "unread" : null;
  const selectedFolder = folders.find((folder) => folder.id === activeFolder);
  // The folders the open one is inside (for the trail above its name), and
  // the ones inside it (tiles above its links).
  const parentFolders = selectedFolder ? folderPath(folders, selectedFolder.id).slice(0, -1) : [];
  const insideFolders = selectedFolder ? childFolders(folders, selectedFolder.id) : [];
  // A folder's count includes the links in the folders inside it.
  const counts = countInside(folders, summary.byFolder);
  const hasLinks = summary.total > 0 || visibleLinks.length > 0;

  // After a change, signed in: the server is asked for the new counts (and
  // the list for its new length), once things settle. reload: links may have
  // joined the list on screen, so it's loaded again from the top.
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  function changed({ reload = false } = {}) {
    if (!server) return;
    if (reload) list.reload();
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      source.summary().then(
        (fresh) => {
          learn([...fresh.unreadLinks, ...fresh.recentLinks, ...fresh.rediscoverLinks]);
          setServerSummary(fresh);
        },
        () => {}
      );
      if (!reload) list.refreshCount();
    }, 300);
  }
  // Would any of these links (as they are after a change) join the list on
  // screen? Then it has to be loaded again to show them in their place.
  function joinsList(changedLinks: Link[]) {
    return listQuery !== null && changedLinks.some((link) => matchesQuery(link, listQuery) && !list.has(link.id));
  }

  async function addLink(url: string, title: string, tags: string, folderId = ""): Promise<SaveProblem | null> {
    if (isDuplicate(links, url)) {
      return "You already saved this link!";
    }
    // Saving a link that's in the Trash offers it back instead of a copy.
    const trashed = trash.links.find((link) => normalizeUrl(link.url) === normalizeUrl(url));
    if (trashed) {
      return {
        message: "This link is in your Trash.",
        actionLabel: "Restore it",
        onAction: () => {
          restoreLinksNow([trashed]);
          showToast("Link restored");
        },
      };
    }

    const link = { ...createLink(url, title, parseTags(tags)), folderId: folderId || undefined };
    const result = await saveLink(link);
    if (typeof result === "string") {
      return result;
    }

    setLinks((current) => [result, ...current]);
    setServerSummary((current) => current && withNewLink(current, result));
    list.addNewest(result);
    changed();
    return null;
  }

  // Tapping a tab slides the page across (the View Transitions API), where
  // the browser has it and animations aren't turned off. flushSync makes
  // React draw the new page inside the transition.
  function slideTo(change: () => void) {
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || calm) {
      change();
      return;
    }
    document.startViewTransition(() => flushSync(change));
  }

  // A smart list and a folder are one choice: picking one leaves the other.
  function selectList(list: SmartList) {
    updateAddress({ list, folder: null });
  }

  function selectFolder(folderId: string | null) {
    updateAddress({ folder: folderId, list: "home" });
  }

  // Why the list is empty, in words (and a drawing) that match what was chosen.
  function emptyState() {
    const drawing = "mx-auto w-48";
    if (query || activeTag)
      return {
        text: "No links match your search.",
        drawing: <Magnifier className={drawing} />,
      };
    // With folders inside, the tiles above are what's there: no drawing.
    if (activeFolder && insideFolders.length > 0)
      return { text: `No links in ${selectedFolder?.name} itself.`, drawing: null };
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
    if (activeList === "unsorted")
      return {
        text: "Every link is in a folder.",
        drawing: <AllWell className={drawing} />,
      };
    return {
      text: "No links match your search.",
      drawing: <Magnifier className={drawing} />,
    };
  }

  function toggleTag(tag: string) {
    updateAddress({ tag: activeTag === tag ? null : tag });
  }

  // Deleting puts links in the Trash, with Undo.
  async function deleteLinks(ids: string[]) {
    const chosen = new Set(ids);
    const deletedAt = new Date().toISOString();
    const gone = links.filter((link) => chosen.has(link.id)).map((link) => ({ ...link, deletedAt }));
    if (gone.length === 0) return;
    for (const link of gone) deleted.add(link.id);
    setLinks((current) => current.filter((link) => !chosen.has(link.id)));
    setTrash((current) => ({ ...current, links: [...gone, ...current.links] }));
    showToast(gone.length === 1 ? "Link moved to the Trash" : `${gone.length} links moved to the Trash`, () => restoreLinksNow(gone));
    await (gone.length === 1 ? removeLink(gone[0].id) : inBatches(gone.map((link) => link.id), removeLinks));
    changed();
  }

  // Out of the Trash at once; a link whose folder is gone comes back without one.
  async function restoreLinksNow(items: Link[]) {
    const ids = new Set(items.map((link) => link.id));
    for (const id of ids) deleted.delete(id);
    const live = new Set(folders.map((folder) => folder.id));
    const back = items.map((link) => ({
      ...link,
      deletedAt: undefined,
      folderId: link.folderId && live.has(link.folderId) ? link.folderId : undefined,
    }));
    setTrash((current) => ({ ...current, links: current.links.filter((link) => !ids.has(link.id)) }));
    setLinks((current) => [...back, ...current.filter((link) => !ids.has(link.id))]);
    const answers = await inBatches([...ids], restoreLinks);
    // Refused (the link limit): back into the Trash, and say why.
    const refused = answers.find((answer) => typeof answer === "string");
    if (refused) {
      for (const id of ids) deleted.add(id);
      setLinks((current) => current.filter((link) => !ids.has(link.id)));
      setTrash((current) => ({ ...current, links: [...items, ...current.links] }));
      showToast(refused);
    }
    changed({ reload: joinsList(back) });
  }

  // The folder comes back (renamed if its name was taken meanwhile), and so
  // do the links that left it when it was deleted, unless they moved since.
  async function restoreFolderNow(folder: Folder) {
    const result = await restoreFolder(folder.id);
    if (typeof result === "string") {
      showToast(result);
      return;
    }
    // What moved up when it was deleted (and is still there) goes back in.
    const movedTo = folder.parentId;
    setTrash((current) => ({ ...current, folders: current.folders.filter((f) => f.id !== folder.id) }));
    setFolders((current) => [
      ...current.map((f) =>
        f.cameFromFolderId === folder.id && f.parentId === movedTo ? { ...f, parentId: folder.id, cameFromFolderId: undefined } : f
      ),
      // Last among the folders it goes back next to, as on the server.
      { ...folder, name: result.name, parentId: result.parentId, position: result.position ?? nextPosition(current, result.parentId ?? null), deletedAt: undefined },
    ]);
    setLinks((current) =>
      current.map((link) =>
        link.cameFromFolderId === folder.id && link.folderId === movedTo
          ? { ...link, folderId: folder.id, cameFromFolderId: undefined }
          : link
      )
    );
    if (result.name !== folder.name) showToast(`Restored as "${result.name}"`);
    changed({ reload: listQuery !== null });
  }

  function restoreFromTrash(kind: "link" | "folder", id: string) {
    if (kind === "link") {
      const link = trash.links.find((l) => l.id === id);
      if (!link) return;
      restoreLinksNow([link]);
      showToast("Link restored");
    } else {
      const folder = trash.folders.find((f) => f.id === id);
      if (folder) restoreFolderNow(folder);
    }
  }

  async function deleteFromTrash({ linkId, folderId, name }: { linkId?: string; folderId?: string; name: string }) {
    if (!window.confirm(`Delete "${name}" forever? This can't be undone.`)) return;
    setTrash((current) => ({
      links: current.links.filter((link) => link.id !== linkId),
      folders: current.folders.filter((folder) => folder.id !== folderId),
    }));
    await deleteForever(linkId ? [linkId] : [], folderId ? [folderId] : []);
  }

  async function emptyTheTrash() {
    setTrash({ links: [], folders: [] });
    await emptyTrash();
  }

  async function editDetails(id: string, input: LinkDetailsInput) {
    // Show the change right away, then use what the server actually stored.
    setLinks((current) => updateDetails(current, id, cleanDetails(input)));
    const saved = await saveLinkDetails(id, input);
    setLinks((current) => updateDetails(current, id, saved));
    changed();
  }
  async function toggleRead(id: string) {
    const link = links.find((l) => l.id === id);
    if (link) await markManyRead([id], !link.readAt, { one: true });
  }

  // Marks links read or unread, with Undo, which puts back each link's own
  // earlier read date. `one`: a card's own button (one link, its own action).
  async function markManyRead(ids: string[], read: boolean, { one = false } = {}) {
    const chosen = new Set(ids);
    const before = links.filter((link) => chosen.has(link.id)).map((link) => ({ id: link.id, readAt: link.readAt ?? null }));
    if (before.length === 0) return;
    const readAt = read ? new Date().toISOString() : undefined;
    setLinks((current) => current.map((link) => (chosen.has(link.id) ? { ...link, readAt } : link)));
    const what = before.length === 1 ? "Marked as" : `${before.length} links marked as`;
    showToast(`${what} ${read ? "read" : "unread"}`, () => putReadDatesBack(before));
    const after = links.filter((link) => chosen.has(link.id)).map((link) => ({ ...link, readAt }));
    await (one ? saveReadStatus(before[0].id, read) : inBatches(ids, (batch) => markLinksRead(batch, read)));
    changed({ reload: joinsList(after) });
  }

  async function putReadDatesBack(before: { id: string; readAt: string | null }[]) {
    for (const { id, readAt } of before) {
      setLinks((current) => setReadAt(current, id, readAt ?? undefined));
    }
    await inBatches(before, setReadDates);
    changed();
  }

  // Several links into one folder (or out of folders, with null), at once,
  // with Undo, which puts each link back in its own earlier folder. `one`:
  // the details panel's Folder menu, for one link.
  async function moveMany(ids: string[], folderId: string | null, { undoable = true, one = false } = {}) {
    const chosen = new Set(ids);
    const before = links.filter((link) => chosen.has(link.id)).map((link) => ({ id: link.id, folderId: link.folderId ?? null }));
    if (before.length === 0) return;
    setLinks((current) =>
      current.map((link) => (chosen.has(link.id) ? { ...link, folderId: folderId ?? undefined, cameFromFolderId: undefined } : link))
    );
    if (undoable) {
      const folderName = folders.find((folder) => folder.id === folderId)?.name;
      const message = folderName
        ? `${before.length === 1 ? "Moved" : `${before.length} links moved`} to ${folderName}`
        : before.length === 1
          ? "Taken out of its folder"
          : `${before.length} links taken out of their folders`;
      showToast(message, () => moveBack(before));
    }
    const after = links.filter((link) => chosen.has(link.id)).map((link) => ({ ...link, folderId: folderId ?? undefined }));
    await (one ? moveToFolder(before[0].id, folderId) : inBatches(before.map((link) => link.id), (batch) => moveLinksToFolder(batch, folderId)));
    changed({ reload: joinsList(after) });
  }

  async function moveBack(before: { id: string; folderId: string | null }[]) {
    const byFolder = new Map<string | null, string[]>();
    for (const { id, folderId } of before) byFolder.set(folderId, [...(byFolder.get(folderId) ?? []), id]);
    await Promise.all([...byFolder].map(([folderId, ids]) => moveMany(ids, folderId, { undoable: false })));
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
    await moveMany([id], folderId ?? null, { one: true });
  }

  // Makes a folder (inside parentId, if given); returns it (for the save
  // box's folder menu) or an error.
  async function makeFolder(name: string, parentId: string | null = null) {
    const result = await createFolder(name, parentId);
    if (typeof result !== "string") {
      // Last among its neighbours (the server says where; the demo doesn't).
      setFolders((current) => [...current, { ...result, position: result.position ?? nextPosition(current, parentId) }]);
    }
    return result;
  }

  async function addFolder(name: string) {
    const result = await makeFolder(name);
    return typeof result === "string" ? result : null;
  }
  // Pinned folders come first on Home. Shown at once, saved in the background.
  async function pinFolder(id: string, pinned: boolean) {
    setFolders((current) => current.map((f) => (f.id === id ? { ...f, pinned: pinned || undefined } : f)));
    await setFolderPinned(id, pinned);
  }

  // Into another folder (or the top level, with null), at `index` among the
  // folders there (left out: last, or where it is if it stays), with Undo,
  // which puts it back in its old place. Shown at once; if the server says
  // no (a name that's taken there), it goes back and the message is returned.
  async function changeFolderPlace(id: string, parentId: string | null, index?: number, { undoable = true } = {}) {
    const folders = latestFolders.current;
    const folder = folders.find((f) => f.id === id);
    if (!folder) return null;
    const from = placeOf(folders, id);
    const to = placeOf(placeFolder(folders, id, parentId, index), id);
    if (to.parentId === from.parentId && to.index === from.index) return null;
    setFolders((current) =>
      placeFolder(current, id, parentId, index).map((f) =>
        f.id === id && parentId !== from.parentId ? { ...f, cameFromFolderId: undefined } : f
      )
    );
    const error = await moveFolder(id, parentId, index);
    if (error) {
      setFolders((current) => placeFolder(current, id, from.parentId, from.index));
      return error;
    }
    if (undoable) {
      const where = folders.find((f) => f.id === parentId)?.name ?? "the top level";
      const message =
        parentId === from.parentId ? `"${folder.name}" moved ${to.index < from.index ? "up" : "down"}` : `"${folder.name}" moved to ${where}`;
      showToast(message, () => changeFolderPlace(id, from.parentId, from.index, { undoable: false }));
    }
    return null;
  }

  // Dragging and the keyboard: a move that's refused says why in the message.
  async function moveFolderNow(id: string, parentId: string | null, index?: number) {
    const error = await changeFolderPlace(id, parentId, index);
    if (error) showToast(error);
  }

  // Where a folder dropped there would go: its new parent and its place
  // among the folders there. null: it can't go there (inside itself), or it
  // wouldn't move at all.
  function folderDropPlace(id: string, spot: DropSpot): { parentId: string | null; index?: number } | null {
    const target = folders.find((f) => f.id === spot.folderId);
    if (!target || folderAndInside(folders, id).has(target.id)) return null;
    const from = placeOf(folders, id);
    if (spot.where === "into") return target.id === from.parentId ? null : { parentId: target.id };
    const { parentId } = placeOf(folders, target.id);
    const others = childFolders(folders, parentId).filter((f) => f.id !== id);
    const index = others.indexOf(target) + (spot.where === "after" ? 1 : 0);
    return parentId === from.parentId && index === from.index ? null : { parentId, index };
  }

  // Links can be dropped on any folder that isn't already home to all of them.
  function canDrop(item: DragItem, spot: DropSpot) {
    if (item.kind === "folder") return folderDropPlace(item.id, spot) !== null;
    const chosen = new Set(item.ids);
    return links.some((link) => chosen.has(link.id) && link.folderId !== spot.folderId);
  }

  // Every drop shows the Undo message, like Move to… does.
  function drop(item: DragItem, spot: DropSpot) {
    if (item.kind === "folder") {
      const place = folderDropPlace(item.id, spot);
      if (place) moveFolderNow(item.id, place.parentId, place.index);
      return;
    }
    const chosen = new Set(item.ids);
    moveMany(
      links.filter((link) => chosen.has(link.id) && link.folderId !== spot.folderId).map((link) => link.id),
      spot.folderId
    );
    if (selecting) stopSelecting();
  }

  // What picking up a link drags: in Select mode with it ticked, every
  // ticked link ("Moving 4 links"); otherwise just this one.
  function linkDragItem(link: Link): DragItem {
    const ids = selecting && selected.has(link.id) ? [...selected] : [link.id];
    return { kind: "links", ids, name: ids.length > 1 ? `${ids.length} links` : link.title || getDomain(link.url) };
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

  // The folder goes to the Trash. What's inside it stays: its links and its
  // folders move up one level (into its parent, or the top level), and
  // remember it, so Restore (or Undo) puts them back. With folders inside,
  // it asks first, since more than one thing moves.
  async function removeFolder(id: string) {
    const folder = folders.find((f) => f.id === id);
    if (!folder) return;
    const parent = folderPath(folders, id).at(-2);
    const movingFolders = childFolders(folders, id).length;
    if (movingFolders > 0) {
      const ownLinks = summary.byFolder[id] ?? 0;
      const what = [movingFolders === 1 ? "1 folder" : `${movingFolders} folders`, ...(ownLinks ? [ownLinks === 1 ? "1 link" : `${ownLinks} links`] : [])].join(" and ");
      const where = parent ? `up into ${parent.name}` : "up to the top level";
      if (!window.confirm(`Delete "${folder.name}"? Its ${what} move ${where}.`)) return;
    }
    const upTo = parent?.id;
    const trashed = { ...folder, parentId: upTo, deletedAt: new Date().toISOString() };
    const renames = new Map(renamesMovingUp(folders, id).map((rename) => [rename.id, rename.name]));
    setFolders((current) =>
      current
        .filter((f) => f.id !== id)
        .map((f) => (f.parentId === id ? { ...f, parentId: upTo, cameFromFolderId: id, name: renames.get(f.id) ?? f.name } : f))
    );
    setTrash((current) => ({ ...current, folders: [trashed, ...current.folders] }));
    setLinks((current) =>
      current.map((link) => (link.folderId === id ? { ...link, folderId: upTo, cameFromFolderId: id } : link))
    );
    // The folder is gone, so the address shouldn't point at it (nor offer it on Back).
    updateAddress({ folder: null }, { replace: true });
    showToast(`"${folder.name}" moved to the Trash`, () => restoreFolderNow(trashed));
    await deleteFolder(id);
    changed();
  }

  // Select all: every link of the list, not just the ones drawn so far
  // (signed in, the server is asked for the rest).
  const [selectingAll, setSelectingAll] = useState(false);
  async function selectAll() {
    const ids = list.allIds();
    if (Array.isArray(ids)) {
      setSelected(new Set(ids));
      return;
    }
    setSelectingAll(true);
    try {
      setSelected(new Set(await ids));
    } catch {
      showToast("Couldn't select them all. Try again.");
    } finally {
      setSelectingAll(false);
    }
  }
  return (
    <DragProvider canDrop={canDrop} onDrop={drop} folderName={(id) => folders.find((f) => f.id === id)?.name ?? ""}>
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
        onImported={(imported) => {
          setLinks((current) => [...imported, ...current]);
          changed({ reload: true });
        }}
      />

      {/* The sidebar on the left (on phones, the Folders tab's full screen), the list on the right. */}
      {/* With the details panel open, wide screens get a third column for it. */}
      <div
        className={`mt-6 grid grid-cols-1 gap-6 md:grid-cols-[14rem_minmax(0,1fr)] ${
          detailsLink ? "lg:grid-cols-[14rem_minmax(0,1fr)_20rem]" : ""
        }`}
      >
        <Sidebar
          summary={summary}
          folders={folders}
          activeList={activeList}
          activeFolder={activeFolder}
          activeTag={activeTag}
          onSelectList={selectList}
          onSelectFolder={selectFolder}
          onSelectTag={toggleTag}
          onCreateFolder={addFolder}
          onMoveFolder={moveFolderNow}
          onChecked={(checked) => {
            // Every link, with its new status.
            setLinks(checked);
            changed({ reload: true });
          }}
          trashCount={trash.links.length + trash.folders.length}
        />

        <div className="min-w-0">
          {activeList === "folders" && !activeFolder ? (
            // Folders (the phone's Folders tab): every folder as a tree, and
            // nothing else; a tap opens one.
            <section aria-labelledby="folders-screen-heading">
              <h2 id="folders-screen-heading" className="text-xl font-semibold text-ink">
                Folders
              </h2>
              <div className="glass mt-4 rounded-2xl p-3">
                {folders.length === 0 && (
                  <p className="px-2 py-3 text-muted">No folders yet. Make one to keep links that belong together.</p>
                )}
                <FolderBar
                  label="All folders"
                  roomy
                  folders={folders}
                  counts={counts}
                  activeFolder={null}
                  onSelect={(folderId) => folderId && selectFolder(folderId)}
                  onCreate={addFolder}
                  onMove={moveFolderNow}
                />
              </div>
            </section>
          ) : activeList === "trash" && !activeFolder ? (
            <TrashView
              links={trash.links}
              folders={trash.folders}
              now={now}
              onRestoreLink={(id) => restoreFromTrash("link", id)}
              onRestoreFolder={(id) => restoreFromTrash("folder", id)}
              onDeleteForever={deleteFromTrash}
              onEmpty={emptyTheTrash}
            />
          ) : showHome ? (
            <HomeView
              summary={summary}
              folders={folders}
              now={now}
              rediscover={rediscover}
              onSelectList={selectList}
              onSelectFolder={selectFolder}
              onShowDetails={setDetailsId}
              onSortThem={() => {
                selectList("unsorted");
                setSelecting(true);
              }}
              onShowFolders={() => selectList("folders")}
              trashCount={trash.links.length + trash.folders.length}
              onSelectTag={toggleTag}
            />
          ) : (
          <>

          {/* What the list is showing: a smart list, or a folder with its own controls. */}
          {/* On phones, the bottom bar's Folders tab opens the sidebar full screen. */}
          {/* A folder's pencil sits right after its name; its edit panel wraps below. */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Where the open folder is: Work › Clients. On phones a long trail
              keeps its first and last steps: Folders › Work › … › Clients. */}
            {/* Phones also get "Folders ›" first: the way back to the Folders screen. */}
            {selectedFolder && (
              <nav aria-label="Folder path" className={`basis-full text-sm text-muted ${parentFolders.length > 0 ? "" : "md:hidden"}`}>
                <ol className="flex min-w-0 flex-wrap items-center gap-1">
                  <li className="flex items-center gap-1 md:hidden">
                    <button onClick={() => selectList("folders")} className="hover:text-ink hover:underline">
                      Folders
                    </button>
                    <span aria-hidden="true">›</span>
                  </li>
                  {parentFolders.map((parent, index) => {
                    const middle = index > 0 && index < parentFolders.length - 1;
                    return (
                      <li key={parent.id} className={`flex min-w-0 items-center gap-1 ${middle ? "max-sm:hidden" : ""}`}>
                        <button onClick={() => selectFolder(parent.id)} className="truncate hover:text-ink hover:underline">
                          {parent.name}
                        </button>
                        <span aria-hidden="true">›</span>
                        {index === 0 && parentFolders.length > 2 && (
                          <span aria-hidden="true" className="sm:hidden">
                            … ›
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            )}
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
                folders={folders}
                onCreateInside={async (name) => {
                  const result = await makeFolder(name, selectedFolder.id);
                  return typeof result === "string" ? result : null;
                }}
                onMove={(parentId, index) => changeFolderPlace(selectedFolder.id, parentId, index)}
                onPin={(pinned) => pinFolder(selectedFolder.id, pinned)}
                onRename={changeFolderName}
                onRecolor={changeFolderColor}
                onChangeIcon={changeFolderIcon}
                onDelete={removeFolder}
              />
            )}
            {/* How many links the list is showing, with search and tag applied. */}
            <span className="ml-auto shrink-0 text-sm text-muted">
              {list.loading === "new" ? "" : list.total === 1 ? "1 link" : `${list.total.toLocaleString("en")} links`}
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
            {/* Signed in, the server is asked once typing stops for a moment. */}
            <SearchBox search={query} onSearch={setQuery} wait={server ? 250 : 0} />
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
            {hasLinks && (
              <button
                onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
                aria-pressed={selecting}
                className="btn-secondary"
              >
                Select
              </button>
            )}
          </div>

          {/* The folders inside the open one, as tiles, before its own links. */}
          {insideFolders.length > 0 && (
            <>
              <ul aria-label={`Folders in ${selectedFolder?.name}`} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {insideFolders.map((inside) => (
                  <li key={inside.id}>
                    <InsideFolderTile folder={inside} count={counts[inside.id] ?? 0} onOpen={() => selectFolder(inside.id)} />
                  </li>
                ))}
              </ul>
              <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={withInside}
                  onChange={(e) => setWithInside(e.target.checked)}
                  className="size-4 accent-[#0071e3]"
                />
                Also show the links in these folders
              </label>
            </>
          )}

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
          {!hasLinks && !list.loading && (
            <div className="mt-6 text-center">
              <EmptyBox className="mx-auto w-48" />
              <p className="mt-2 text-muted">
                No links yet. Add your first one above.
              </p>
            </div>
          )}
          {list.loading === "new" && (
            <p role="status" className="mt-6 text-center text-muted">
              Loading links…
            </p>
          )}
          {list.failed && (
            <div role="alert" className="mt-6 text-center text-muted">
              <p>Your links didn&apos;t load. Check your connection and try again.</p>
              <button onClick={list.reload} className="btn-secondary mt-3">
                Try again
              </button>
            </div>
          )}
          {hasLinks && visibleLinks.length === 0 && !list.loading && !list.failed && (
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
                  onDelete={(id) => deleteLinks([id])}
                  onEditDetails={editDetails}
                  onToggleRead={toggleRead}
                  folders={folders}
                  onTagClick={toggleTag}
                  compact={view === "list"}
                  onShowDetails={setDetailsId}
                  selecting={selecting}
                  selected={selected.has(link.id)}
                  onToggleSelect={toggleSelected}
                  dragItem={() => linkDragItem(link)}
                />
              ))}
            </ul>
          )}
          {/* A page at a time: the next one comes as the end of the list gets near. */}
          {list.hasMore && <ShowMore onMore={list.loadMore} />}
          </>
          )}
        </div>

        {addingLinks && selectedFolder && (
          <AddLinksSheet
            folderName={selectedFolder.name}
            links={server ? undefined : links.filter((link) => link.folderId !== selectedFolder.id)}
            find={server ? findLinksToAdd : undefined}
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
            className="glass-bar fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-3xl px-4 py-3 motion-safe:animate-rise-in md:bottom-6 md:flex-nowrap"
          >
            <span className="mr-auto whitespace-nowrap text-sm font-medium text-ink" aria-live="polite">
              {selected.size === 0 ? "Tick links to select them" : `${selected.size} selected`}
            </span>
            {/* Nothing ticked yet: no greyed-out buttons, just a quick way to tick them all. */}
            {selected.size === 0 ? (
              <button onClick={selectAll} disabled={selectingAll} className="btn-secondary whitespace-nowrap disabled:opacity-60">
                {selectingAll ? "Selecting…" : list.total > visibleLinks.length ? `Select all ${list.total.toLocaleString("en")}` : "Select all"}
              </button>
            ) : (
              // On phones the actions get a row of their own, under the count.
              <div className="order-last flex w-full gap-2 md:order-none md:w-auto">
                <select
                  value=""
                  onChange={(e) => {
                    const target = e.target.value;
                    if (!target) return;
                    moveMany([...selected], target === "none" ? null : target);
                    stopSelecting();
                  }}
                  aria-label="Move selected links to folder"
                  className="field min-w-0 flex-1 py-1.5 md:w-36 md:flex-none"
                >
                  <option value="">Move to…</option>
                  <option value="none">No folder</option>
                  {flattenTree(folders).map(({ folder, depth }) => (
                    <option key={folder.id} value={folder.id}>
                      {indentedName(folder.name, depth)}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    markManyRead([...selected], true);
                    stopSelecting();
                  }}
                  className="btn-secondary whitespace-nowrap"
                >
                  Mark read
                </button>
                <button
                  onClick={() => {
                    deleteLinks([...selected]);
                    stopSelecting();
                  }}
                  className="btn-secondary text-danger"
                >
                  Delete
                </button>
              </div>
            )}
            <button onClick={stopSelecting} className="btn-primary">
              Done
            </button>
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
              deleteLinks([id]);
            }}
            onTagClick={toggleTag}
          />
        )}
      </div>

      <BottomBar
        active={phoneTab}
        onSelectList={(list) => slideTo(() => selectList(list))}
        onSave={() => setSavingOnPhone(true)}
        accountHref={user ? "/account" : "/"}
        accountLabel={user ? "You" : "Sign in"}
      />
      <PhoneDropPanel folders={folders} />
      <UndoToast toast={toast} onClose={closeToast} />
      {/* Room under the last link, so the bottom bar never covers it. */}
      <div aria-hidden="true" className="h-24 md:hidden" />
    </DragProvider>
  );
}

// The search box keeps what's typed itself, and passes it on at once (in
// memory) or once typing stops for `wait` ms (signed in: one question to
// the server instead of one per key). `search`: the search the list shows,
// for when the box comes back (after Home, say).
function SearchBox({ search, onSearch, wait }: { search: string; onSearch: (text: string) => void; wait: number }) {
  const [text, setText] = useState(search);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <input
      type="search"
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        clearTimeout(timer.current);
        if (wait === 0) onSearch(next);
        else timer.current = setTimeout(() => onSearch(next), wait);
      }}
      placeholder="Search links..."
      aria-label="Search links"
      className="field min-w-0 flex-1 basis-full sm:basis-0"
    />
  );
}

// The actions, each one's work remembered in `saving` until it's done.
function remembered<A extends Record<string, (...args: never[]) => Promise<unknown>>>(actions: A, saving: Set<Promise<unknown>>): A {
  return Object.fromEntries(
    Object.entries(actions).map(([name, action]) => [
      name,
      (...args: never[]) => {
        const work = action(...args);
        saving.add(work);
        work.then(
          () => saving.delete(work),
          () => saving.delete(work)
        );
        return work;
      },
    ])
  ) as A;
}

// A LinkSource whose questions wait for the changes still being saved.
function afterSaving(source: LinkSource, saving: Set<Promise<unknown>>): LinkSource {
  const settled = () => Promise.allSettled([...saving]);
  return {
    page: async (...args) => (await settled(), source.page(...args)),
    all: async (...args) => (await settled(), source.all(...args)),
    count: async (...args) => (await settled(), source.count(...args)),
    summary: async () => (await settled(), source.summary()),
  };
}

// Bulk actions take at most BULK_MAX links at a time (the server drops the
// rest), so a longer selection goes in several batches, one after another.
async function inBatches<T, R>(items: T[], action: (batch: T[]) => Promise<R>): Promise<R[]> {
  const answers: R[] = [];
  for (let i = 0; i < items.length; i += BULK_MAX) answers.push(await action(items.slice(i, i + BULK_MAX)));
  return answers;
}

// The end of a long list: the next links come on their own as it scrolls
// into view (with room to spare, so there's no wait), and the button is
// there for keyboards, screen readers and browsers without that.
function ShowMore({ onMore }: { onMore: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const latest = useRef(onMore);
  useEffect(() => {
    latest.current = onMore;
  });
  useEffect(() => {
    const element = button.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && latest.current(), {
      rootMargin: "800px 0px",
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="mt-4 text-center">
      <button ref={button} onClick={onMore} className="btn-secondary">
        Show more links
      </button>
    </div>
  );
}

// A folder inside the open one, as a tile: opens it, takes links and folders
// dropped on it, and can be picked up itself (onto the sidebar, say).
function InsideFolderTile({ folder, count, onOpen }: { folder: Folder; count: number; onOpen: () => void }) {
  const drag = useDrag();
  const over = drag.over?.folderId === folder.id;
  const pickedUp = drag.item?.kind === "folder" && drag.item.id === folder.id;
  return (
    <button
      onClick={onOpen}
      data-drop-folder={folder.id}
      {...drag.dragSource(() => ({ kind: "folder", id: folder.id, name: folder.name }))}
      className={`glass flex w-full items-center gap-2 rounded-2xl p-3 text-left transition-shadow hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${DRAG_SOURCE_CLASS} ${over ? "drop-into" : ""} ${pickedUp ? "opacity-50" : ""}`}
    >
      {folder.icon ? (
        <FolderIconDrawing name={folder.icon} className={`size-6 shrink-0 ${FOLDER_TEXT_CLASS[folder.color ?? "gray"]}`} />
      ) : (
        <span aria-hidden="true" className={`mx-1.5 size-3 shrink-0 rounded-full ${FOLDER_DOT_CLASS[folder.color ?? "gray"]}`} />
      )}
      <span className="min-w-0 flex-1 truncate font-medium text-ink">{folder.name}</span>
      <span aria-hidden="true" className="text-sm text-muted">
        {count}
      </span>
    </button>
  );
}

// Phones have no sidebar to drop on, so while links are picked up, every
// folder shows at the bottom of the screen, within reach of the thumb. Screen
// readers hear where the links are over instead (see DragProvider).
function PhoneDropPanel({ folders }: { folders: Folder[] }) {
  const { item, over } = useDrag();
  if (item?.kind !== "links" || folders.length === 0) return null;
  return (
    <div
      aria-hidden="true"
      className="glass-bar fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-h-[40vh] max-w-2xl overflow-y-auto rounded-3xl p-3 motion-safe:animate-rise-in md:hidden"
    >
      <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">Drop on a folder</p>
      <ul className="flex flex-wrap gap-2">
        {flattenTree(folders).map(({ folder }) => (
          <li
            key={folder.id}
            data-drop-folder={folder.id}
            className={`flex items-center gap-1.5 rounded-full bg-surface px-3 py-2 text-sm font-medium text-ink ring-1 ring-line ${over?.folderId === folder.id ? "drop-into" : ""}`}
          >
            {folder.icon ? (
              <FolderIconDrawing name={folder.icon} className={`size-4 shrink-0 ${FOLDER_TEXT_CLASS[folder.color ?? "gray"]}`} />
            ) : (
              <span className={`size-2.5 shrink-0 rounded-full ${FOLDER_DOT_CLASS[folder.color ?? "gray"]}`} />
            )}
            {folder.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
