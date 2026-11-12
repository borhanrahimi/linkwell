"use server";

import { after } from "next/server";
import {
  deleteForever as deleteForeverFromTrash,
  emptyTrash as emptyTrashNow,
  findTrashedLink,
  getFolderAncestors,
  updateFolderPlace,
  updateFolderPinned,
  getLinks,
  getTrash,
  restoreFolder as restoreFolderFromTrash,
  restoreLinks as restoreLinksFromTrash,
  trashFolder,
  trashLinks,
  getFolders,
  insertFolder,
  insertLink,
  insertLinks,
  updateFolderName,
  updateFolderColor,
  updateFolderIcon,
  updateLinkFolder,
  updateLinksFolder,
  updateLinksReadAt,
  updateLinkImage,
  updateLinkStatus,
  updateLinkDetails,
  updateLinkReadAt,
  isUsernameTaken,
  updateUsername,
  countAction,
} from "@/lib/data";
import { checkLink } from "@/lib/checkLink";
import { fetchPageInfo } from "@/lib/fetchTitle";
import { getUserId } from "@/lib/session";
import { cleanDate, cleanDetails, cleanFolderName, cleanIds, cleanNewLink, IN_TRASH, isDuplicate, normalizeUrl } from "@/lib/links";
import { cleanBookmark, IMPORT_BATCH_SIZE } from "@/lib/bookmarks";
import { childFolders, freeFolderName, isFolderColor, isFolderIcon, nameTakenIn, nextFolderColor, placeFolder, renamesMovingUp } from "@/lib/folders";
import {
  MAX_FOLDERS,
  MAX_LINKS,
  RATE_LIMITS,
  TOO_FAST,
  TOO_MANY_FOLDERS,
  TOO_MANY_LINKS,
  windowStart,
  type RateLimitedAction,
} from "@/lib/limits";
import { normalizeUsername, usernameError } from "@/lib/username";
import type {
  Folder,
  FolderColor,
  FolderIcon,
  ImportedBookmark,
  Link,
  LinkDetails,
  LinkDetailsInput,
} from "@/types/link";

// Server Actions are public addresses, so each one asks who is calling first
// (getUserId throws when nobody is signed in) and only touches that user's data.

// True when this user has used the action more often than RATE_LIMITS allows
// in the current window. Every call counts, even ones that fail later.
async function isTooFast(userId: string, action: RateLimitedAction): Promise<boolean> {
  const { max, windowSeconds } = RATE_LIMITS[action];
  return (await countAction(userId, action, windowStart(new Date(), windowSeconds))) > max;
}

export async function saveLink(input: Link): Promise<Link | string> {
  const userId = await getUserId();
  if (await isTooFast(userId, "saveLink")) {
    return TOO_FAST;
  }
  // Never trust what the browser sends: only an http(s) link, within the
  // length limits, with just the fields a new link may have.
  const link = cleanNewLink(input);
  if (typeof link === "string") {
    return link;
  }
  const saved = await getLinks(userId);
  if (isDuplicate(saved, link.url)) {
    return "You already saved this link!";
  }
  // Not a copy of a link in the Trash: the browser offers to restore that one.
  if (await findTrashedLink(userId, [link.url, normalizeUrl(link.url)])) {
    return IN_TRASH;
  }
  if (saved.length >= MAX_LINKS) {
    return TOO_MANY_LINKS;
  }
  // Saving straight into a folder: only into one of the user's own folders.
  // Anything else (someone else's folder, a made-up id) saves with no folder.
  const folderId = typeof input?.folderId === "string" ? input.folderId : null;
  const inOwnFolder = folderId !== null && (await getFolders(userId)).some((folder) => folder.id === folderId);
  // No title typed: read the page now, for its title and picture. With a
  // title typed, saving doesn't wait: the picture is looked for just after
  // the answer is sent (after()), and shows from the next visit.
  const page = link.title ? {} : await fetchPageInfo(link.url);
  const stored = {
    ...link,
    ...(inOwnFolder && { folderId }),
    title: link.title ?? page.title,
    ...(page.image && { image: page.image }),
  };
  await insertLink(userId, link.title ? stored : { ...stored, image: page.image ?? "" });
  if (link.title) {
    after(async () => {
      const { image } = await fetchPageInfo(link.url);
      await updateLinkImage(userId, link.id, image ?? "");
    });
  }
  return stored;
}

// Deleting puts things in the Trash; they're gone for good after 30 days
// (the daily job), or sooner with Delete forever or Empty trash.
export async function removeLink(id: string) {
  await trashLinks(await getUserId(), cleanIds([id]));
}

export async function removeLinks(ids: string[]) {
  await trashLinks(await getUserId(), cleanIds(ids));
}

// Returns the restored links (a link whose folder is gone comes back without
// one), or a message when they'd go over the link limit.
export async function restoreLinks(ids: string[]): Promise<Link[] | string> {
  const userId = await getUserId();
  const chosen = cleanIds(ids);
  if ((await getLinks(userId)).length + chosen.length > MAX_LINKS) {
    return TOO_MANY_LINKS;
  }
  return restoreLinksFromTrash(userId, chosen);
}

// For the share page: saving a link that's in the Trash offers this instead.
export async function restoreLinkByUrl(url: string): Promise<Link | string> {
  const userId = await getUserId();
  const address = typeof url === "string" ? url.trim() : "";
  const trashed = address && (await findTrashedLink(userId, [address, normalizeUrl(address)]));
  if (!trashed) {
    return "That link isn't in your Trash any more.";
  }
  const restored = await restoreLinks([trashed.id]);
  return typeof restored === "string" ? restored : (restored[0] ?? "That link isn't in your Trash any more.");
}

// Returns the restored folder, or a message. It goes back into the folder it
// was in (the top level if that one is gone too), renamed "Reading (2)" if a
// folder there took its name meanwhile.
export async function restoreFolder(id: string): Promise<Folder | string> {
  const userId = await getUserId();
  const [live, trash] = await Promise.all([getFolders(userId), getTrash(userId)]);
  const folder = trash.folders.find((f) => f.id === id);
  if (!folder) {
    return "That folder isn't in your Trash any more.";
  }
  if (live.length >= MAX_FOLDERS) {
    return TOO_MANY_FOLDERS;
  }
  const movedTo = folder.parentId ?? null;
  const parentId = movedTo && live.some((f) => f.id === movedTo) ? movedTo : null;
  const name = freeFolderName(folder.name, childFolders(live, parentId).map((f) => f.name));
  return (
    (await restoreFolderFromTrash(userId, id, name, parentId, movedTo)) ?? "That folder isn't in your Trash any more."
  );
}

export async function deleteForever(linkIds: string[], folderIds: string[]) {
  await deleteForeverFromTrash(await getUserId(), cleanIds(linkIds), cleanIds(folderIds));
}

export async function emptyTrash() {
  await emptyTrashNow(await getUserId());
}

// Saves the Edit form. The server cleans the text itself (never trust the
// browser) and returns the cleaned details, so the card shows what was stored.
export async function saveLinkDetails(
  id: string,
  input: LinkDetailsInput
): Promise<LinkDetails> {
  const userId = await getUserId();
  const details = cleanDetails(input);
  await updateLinkDetails(userId, id, details);
  return details;
}

export async function saveReadStatus(id: string, read: boolean) {
  await updateLinkReadAt(await getUserId(), id, read ? new Date() : null);
}

export async function moveToFolder(id: string, folderId: string | null) {
  const userId = await getUserId();
  if (
    folderId &&
    !(await getFolders(userId)).some((folder) => folder.id === folderId)
  ) {
    return;
  }
  await updateLinkFolder(userId, id, folderId);
}

// Moves many links at once (Select mode, "Add links" in a folder). Only real
// ids of the user's own links, and only into one of the user's own folders.
export async function moveLinksToFolder(ids: string[], folderId: string | null) {
  const userId = await getUserId();
  if (folderId !== null && !(await getFolders(userId)).some((folder) => folder.id === folderId)) {
    return;
  }
  await updateLinksFolder(userId, cleanIds(ids), folderId);
}

// Marks many links read or unread at once. The server picks the time.
export async function markLinksRead(ids: string[], read: boolean) {
  await updateLinksReadAt(await getUserId(), cleanIds(ids), read === true ? new Date() : null);
}

// Undo for marking read or unread: puts back each link's own earlier read
// date (or none). Only real dates that aren't in the future.
export async function setReadDates(changes: { id: string; readAt: string | null }[]) {
  const userId = await getUserId();
  if (!Array.isArray(changes)) return;
  const byDate = new Map<string | null, string[]>();
  for (const change of changes) {
    const [id] = cleanIds([change?.id]);
    if (!id) continue;
    const readAt = change.readAt === null ? null : (cleanDate(change.readAt) ?? null);
    byDate.set(readAt, [...(byDate.get(readAt) ?? []), id]);
  }
  // Usually one or two groups: the links that were unread, and one date.
  await Promise.all(
    [...byDate].map(([readAt, ids]) => updateLinksReadAt(userId, cleanIds(ids), readAt ? new Date(readAt) : null))
  );
}

// Links from this browser's localStorage, from before v0.5.
const OLD_LINKS_MAX = 1000;

export async function importLinks(oldLinks: Link[]): Promise<Link[]> {
  const userId = await getUserId();
  if (!Array.isArray(oldLinks) || oldLinks.length > OLD_LINKS_MAX) {
    throw new Error("Too many links to import at once.");
  }
  if (await isTooFast(userId, "importLinks")) {
    return [];
  }
  const [saved, trash] = await Promise.all([getLinks(userId), getTrash(userId)]);
  // Links in the Trash count as saved: importing doesn't make copies of them.
  const known = new Set([...saved, ...trash.links].map((link) => normalizeUrl(link.url)));
  const imported: Link[] = [];

  for (const old of oldLinks) {
    if (saved.length + imported.length >= MAX_LINKS) {
      break;
    }
    // Same checks as saveLink; a fresh id, but the date it was first saved.
    const link = cleanNewLink({ ...old, id: "" });
    if (typeof link === "string" || known.has(normalizeUrl(link.url))) {
      continue;
    }
    known.add(normalizeUrl(link.url));
    imported.push(link);
  }

  await insertLinks(userId, imported);
  return imported;
}

// Returns the links with their new status, or a message when it's too soon.
export async function checkAllLinks(): Promise<Link[] | string> {
  const userId = await getUserId();
  if (await isTooFast(userId, "checkLinks")) {
    return TOO_FAST;
  }
  const links = await getLinks(userId);

  await Promise.all(
    links.map(async (link) => {
      const status = await checkLink(link.url);
      await updateLinkStatus(userId, link.id, status);
    })
  );

  return getLinks(userId);
}
// Saves one batch of bookmarks from a bookmarks file. Skips links you already
// have, and puts each link in the folder with the same name (made if needed).
export async function importBookmarks(
  input: ImportedBookmark[]
): Promise<{ added: number; skipped: number } | string> {
  const userId = await getUserId();
  if (!Array.isArray(input) || input.length > IMPORT_BATCH_SIZE) {
    throw new Error("Too many bookmarks in one batch.");
  }
  if (await isTooFast(userId, "importBookmarks")) {
    return TOO_FAST;
  }

  const [saved, trash] = await Promise.all([getLinks(userId), getTrash(userId)]);
  const known = new Set([...saved, ...trash.links].map((link) => normalizeUrl(link.url)));
  const folders = await getFolders(userId);
  const added: Link[] = [];

  for (const bookmark of input.map((item) => cleanBookmark(item))) {
    // Stop at the account's link limit; the rest count as skipped.
    if (saved.length + added.length >= MAX_LINKS) break;
    if (!bookmark || known.has(normalizeUrl(bookmark.url))) continue;
    known.add(normalizeUrl(bookmark.url));

    // Each level of the path is found (by name, among its neighbours) or
    // made. At the folder limit, the link stays in the deepest one there is.
    let folderId: string | undefined;
    for (const name of bookmark.folderPath ?? []) {
      const parentId = folderId ?? null;
      let folder = childFolders(folders, parentId).find((f) => f.name.toLowerCase() === name.toLowerCase());
      if (!folder && folders.length < MAX_FOLDERS) {
        folder = await insertFolder(userId, name, nextFolderColor(folders.length), parentId);
        folders.push(folder);
      }
      if (!folder) break;
      folderId = folder.id;
    }

    added.push({
      id: crypto.randomUUID(),
      url: bookmark.url,
      title: bookmark.title,
      tags: bookmark.tags,
      createdAt: bookmark.addDate ?? new Date().toISOString(),
      folderId,
    });
  }

  await insertLinks(userId, added);
  return { added: added.length, skipped: input.length - added.length };
}

// What creating, renaming or moving a folder says when the name is taken
// where it would go: "Work" for the top level, "Ideas in Work" inside a folder.
function nameTaken(name: string, parent?: Folder) {
  return parent ? `There's already a folder called "${name}" in ${parent.name}.` : `You already have a folder called "${name}".`;
}

// parentId: make it inside that folder (one of the user's own), or null for
// the top level.
export async function createFolder(name: string, parentId: string | null = null): Promise<Folder | string> {
  const userId = await getUserId();
  const cleaned = cleanFolderName(name);
  if ("error" in cleaned) {
    return cleaned.error;
  }
  const trimmed = cleaned.name;
  const existing = await getFolders(userId);
  if (existing.length >= MAX_FOLDERS) {
    return TOO_MANY_FOLDERS;
  }
  const parent = typeof parentId === "string" ? existing.find((folder) => folder.id === parentId) : undefined;
  if (parentId !== null && !parent) {
    return "That folder doesn't exist any more.";
  }
  if (nameTakenIn(existing, trimmed, parent?.id ?? null)) {
    return nameTaken(trimmed, parent);
  }
  return insertFolder(userId, trimmed, nextFolderColor(existing.length), parent?.id ?? null);
}

export async function renameFolder(
  id: string,
  name: string
): Promise<string | null> {
  const userId = await getUserId();
  const cleaned = cleanFolderName(name);
  if ("error" in cleaned) {
    return cleaned.error;
  }
  const trimmed = cleaned.name;
  const folders = await getFolders(userId);
  const parentId = folders.find((folder) => folder.id === id)?.parentId ?? null;
  if (nameTakenIn(folders, trimmed, parentId, id)) {
    return nameTaken(trimmed, folders.find((folder) => folder.id === parentId));
  }
  await updateFolderName(userId, id, trimmed);
  return null;
}

// Moves a folder, with everything inside it, into another folder (or to the
// top level with null), at `index` among the folders there (dragging, Move up
// and Move down); without one it goes last, or keeps its place if it stays.
// Never into itself or a folder inside it: that would make a loop, a folder
// inside itself. Returns a message, or null when moved.
export async function moveFolder(id: string, parentId: string | null, index?: number): Promise<string | null> {
  const userId = await getUserId();
  const folders = await getFolders(userId);
  const folder = folders.find((f) => f.id === id);
  const parent = typeof parentId === "string" ? folders.find((f) => f.id === parentId) : undefined;
  if (!folder || (parentId !== null && !parent)) {
    return "That folder doesn't exist any more.";
  }
  // Asked of the database, so it's right even if another tab moved folders.
  if (parent && (parent.id === id || (await getFolderAncestors(userId, parent.id)).includes(id))) {
    return "A folder can't go inside itself.";
  }
  if (nameTakenIn(folders, folder.name, parent?.id ?? null, id)) {
    return nameTaken(folder.name, parent);
  }
  const place = Number.isInteger(index) ? index : undefined;
  const order = childFolders(placeFolder(folders, id, parent?.id ?? null, place), parent?.id ?? null).map((f) => f.id);
  await updateFolderPlace(userId, id, parent?.id ?? null, order);
  return null;
}

export async function setFolderColor(id: string, color: FolderColor) {
  const userId = await getUserId();
  // Only colours from the palette: anything else could end up in a class name.
  if (!isFolderColor(color)) {
    return;
  }
  await updateFolderColor(userId, id, color);
}

// Pinned folders come first in Home's "Your folders".
export async function setFolderPinned(id: string, pinned: boolean) {
  await updateFolderPinned(await getUserId(), id, pinned === true);
}

// null takes the icon away, and the folder shows its dot again.
export async function setFolderIcon(id: string, icon: FolderIcon | null) {
  const userId = await getUserId();
  if (icon !== null && !isFolderIcon(icon)) {
    return;
  }
  await updateFolderIcon(userId, id, icon);
}

// The folder goes to the Trash; its links and the folders inside it move up
// one level (see trashFolder). A folder moving up next to one with the same
// name becomes "Ideas (2)".
export async function deleteFolder(id: string) {
  const userId = await getUserId();
  const folders = await getFolders(userId);
  const folder = folders.find((f) => f.id === id);
  if (!folder) return;
  const parentId = folders.some((f) => f.id === folder.parentId) ? folder.parentId! : null;
  await trashFolder(userId, id, parentId, renamesMovingUp(folders, id));
}

// Returns an error message, or null when the username was saved.
export async function saveUsername(input: string): Promise<string | null> {
  const userId = await getUserId();
  const username = normalizeUsername(input);
  const error = usernameError(username);
  if (error) {
    return error;
  }
  if (await isUsernameTaken(userId, username)) {
    return `@${username} is already taken.`;
  }
  // The UNIQUE constraint in the database is the final guard, in case two
  // people pick the same name at the same moment.
  await updateUsername(userId, username);
  return null;
}
