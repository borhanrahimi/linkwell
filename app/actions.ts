"use server";

import {
  deleteFolderById,
  deleteLinkById,
  getLinks,
  getFolders,
  insertFolder,
  insertLink,
  updateFolderName,
  updateLinkFolder,
  updateLinkStatus,
  updateLinkTitle,
  updateLinkReadAt,
  isUsernameTaken,
  updateUsername,
} from "@/lib/data";
import { checkLink } from "@/lib/checkLink";
import { fetchTitle } from "@/lib/fetchTitle";
import { getUserId } from "@/lib/session";
import { isDuplicate } from "@/lib/links";
import { normalizeUsername, usernameError } from "@/lib/username";
import type { Folder, Link } from "@/types/link";

// Server Actions are public addresses, so each one asks who is calling first
// (getUserId throws when nobody is signed in) and only touches that user's data.

export async function saveLink(link: Link): Promise<Link | string> {
  const userId = await getUserId();
  if (!link.url.trim()) {
    return "Please paste a link.";
  }
  if (isDuplicate(await getLinks(userId), link.url)) {
    return "You already saved this link!";
  }
  const saved = { ...link, title: link.title ?? (await fetchTitle(link.url)) };
  await insertLink(userId, saved);
  return saved;
}

export async function removeLink(id: string) {
  await deleteLinkById(await getUserId(), id);
}

export async function saveTitle(id: string, title: string) {
  await updateLinkTitle(await getUserId(), id, title);
}

export async function saveReadStatus(id: string, read: boolean) {
  await updateLinkReadAt(await getUserId(), id, read ? new Date() : null);
}

export async function moveToFolder(id: string, folderId: string | null) {
  const userId = await getUserId();
  if (folderId && !(await getFolders(userId)).some((folder) => folder.id === folderId)) {
    return;
  }
  await updateLinkFolder(userId, id, folderId);
}

export async function importLinks(oldLinks: Link[]): Promise<Link[]> {
  const userId = await getUserId();
  const saved = await getLinks(userId);
  const imported: Link[] = [];

  for (const old of oldLinks) {
    if (!old.url?.trim() || isDuplicate([...saved, ...imported], old.url)) {
      continue;
    }
    const link = { ...old, id: crypto.randomUUID(), tags: old.tags ?? [] };
    await insertLink(userId, link);
    imported.push(link);
  }

  return imported;
}

export async function checkAllLinks(): Promise<Link[]> {
  const userId = await getUserId();
  const links = await getLinks(userId);

  await Promise.all(
    links.map(async (link) => {
      const status = await checkLink(link.url);
      await updateLinkStatus(userId, link.id, status);
    })
  );

  return getLinks(userId);
}

export async function createFolder(name: string): Promise<Folder | string> {
  const userId = await getUserId();
  const trimmed = name.trim();
  if (!trimmed) {
    return "Please give the folder a name.";
  }
  const existing = await getFolders(userId);
  if (
    existing.some(
      (folder) => folder.name.toLowerCase() === trimmed.toLowerCase()
    )
  ) {
    return `You already have a folder called "${trimmed}".`;
  }
  return insertFolder(userId, trimmed);
}

export async function renameFolder(
  id: string,
  name: string
): Promise<string | null> {
  const userId = await getUserId();
  const trimmed = name.trim();
  if (!trimmed) {
    return "Please give the folder a name.";
  }
  const others = (await getFolders(userId)).filter((folder) => folder.id !== id);
  if (
    others.some((folder) => folder.name.toLowerCase() === trimmed.toLowerCase())
  ) {
    return `You already have a folder called "${trimmed}".`;
  }
  await updateFolderName(userId, id, trimmed);
  return null;
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
