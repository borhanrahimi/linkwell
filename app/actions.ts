"use server";

import {
  deleteFolderById,
  deleteLinkById,
  getLinks,
  getFolders,
  insertFolder,
  insertLink,
  insertLinks,
  updateFolderName,
  updateFolderColor,
  updateFolderIcon,
  updateLinkFolder,
  updateLinkStatus,
  updateLinkDetails,
  updateLinkReadAt,
  isUsernameTaken,
  updateUsername,
  countAction,
} from "@/lib/data";
import { checkLink } from "@/lib/checkLink";
import { fetchTitle } from "@/lib/fetchTitle";
import { getUserId } from "@/lib/session";
import { cleanDetails, cleanFolderName, cleanNewLink, isDuplicate, normalizeUrl } from "@/lib/links";
import { cleanBookmark, IMPORT_BATCH_SIZE } from "@/lib/bookmarks";
import { isFolderColor, isFolderIcon, nextFolderColor } from "@/lib/folders";
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
  if (saved.length >= MAX_LINKS) {
    return TOO_MANY_LINKS;
  }
  // Saving straight into a folder: only into one of the user's own folders.
  // Anything else (someone else's folder, a made-up id) saves with no folder.
  const folderId = typeof input?.folderId === "string" ? input.folderId : null;
  const inOwnFolder = folderId !== null && (await getFolders(userId)).some((folder) => folder.id === folderId);
  const withTitle = {
    ...link,
    ...(inOwnFolder && { folderId }),
    title: link.title ?? (await fetchTitle(link.url)),
  };
  await insertLink(userId, withTitle);
  return withTitle;
}

export async function removeLink(id: string) {
  await deleteLinkById(await getUserId(), id);
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
  const saved = await getLinks(userId);
  const known = new Set(saved.map((link) => normalizeUrl(link.url)));
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

  const saved = await getLinks(userId);
  const known = new Set(saved.map((link) => normalizeUrl(link.url)));
  const folders = await getFolders(userId);
  const added: Link[] = [];

  for (const bookmark of input.map((item) => cleanBookmark(item))) {
    // Stop at the account's link limit; the rest count as skipped.
    if (saved.length + added.length >= MAX_LINKS) break;
    if (!bookmark || known.has(normalizeUrl(bookmark.url))) continue;
    known.add(normalizeUrl(bookmark.url));

    let folderId: string | undefined;
    if (bookmark.folder) {
      const name = bookmark.folder;
      let folder = folders.find(
        (f) => f.name.toLowerCase() === name.toLowerCase()
      );
      // At the folder limit, the link is still imported, just without a folder.
      if (!folder && folders.length < MAX_FOLDERS) {
        folder = await insertFolder(userId, name, nextFolderColor(folders.length));
        folders.push(folder);
      }
      folderId = folder?.id;
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

export async function createFolder(name: string): Promise<Folder | string> {
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
  if (
    existing.some(
      (folder) => folder.name.toLowerCase() === trimmed.toLowerCase()
    )
  ) {
    return `You already have a folder called "${trimmed}".`;
  }
  return insertFolder(userId, trimmed, nextFolderColor(existing.length));
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
  const others = (await getFolders(userId)).filter(
    (folder) => folder.id !== id
  );
  if (
    others.some((folder) => folder.name.toLowerCase() === trimmed.toLowerCase())
  ) {
    return `You already have a folder called "${trimmed}".`;
  }
  await updateFolderName(userId, id, trimmed);
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

// null takes the icon away, and the folder shows its dot again.
export async function setFolderIcon(id: string, icon: FolderIcon | null) {
  const userId = await getUserId();
  if (icon !== null && !isFolderIcon(icon)) {
    return;
  }
  await updateFolderIcon(userId, id, icon);
}

export async function deleteFolder(id: string) {
  await deleteFolderById(await getUserId(), id);
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
