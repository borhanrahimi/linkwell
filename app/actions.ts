"use server";

import {
  deleteLinkById,
  getLinks,
  getFolders,
  insertFolder,
  insertLink,
  updateLinkFolder,
  updateLinkStatus,
  updateLinkTitle,
  updateLinkReadAt,
} from "@/lib/data";
import { checkLink } from "@/lib/checkLink";
import { fetchTitle } from "@/lib/fetchTitle";
import { isDuplicate } from "@/lib/links";
import type { Folder, Link } from "@/types/link";

export async function saveLink(link: Link): Promise<Link | string> {
  if (!link.url.trim()) {
    return "Please paste a link.";
  }
  if (isDuplicate(await getLinks(), link.url)) {
    return "You already saved this link!";
  }
  const saved = { ...link, title: link.title ?? (await fetchTitle(link.url)) };
  await insertLink(saved);
  return saved;
}

export async function removeLink(id: string) {
  await deleteLinkById(id);
}

export async function saveTitle(id: string, title: string) {
  await updateLinkTitle(id, title);
}

export async function saveReadStatus(id: string, read: boolean) {
  await updateLinkReadAt(id, read ? new Date() : null);
}

export async function moveToFolder(id: string, folderId: string | null) {
  await updateLinkFolder(id, folderId);
}

export async function importLinks(oldLinks: Link[]): Promise<Link[]> {
  const saved = await getLinks();
  const imported: Link[] = [];

  for (const old of oldLinks) {
    if (!old.url?.trim() || isDuplicate([...saved, ...imported], old.url)) {
      continue;
    }
    const link = { ...old, id: crypto.randomUUID(), tags: old.tags ?? [] };
    await insertLink(link);
    imported.push(link);
  }

  return imported;
}

export async function checkAllLinks(): Promise<Link[]> {
  const links = await getLinks();

  await Promise.all(
    links.map(async (link) => {
      const status = await checkLink(link.url);
      await updateLinkStatus(link.id, status);
    })
  );

  return getLinks();
}


export async function createFolder(name: string): Promise<Folder | string> {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Please give the folder a name.";
  }
  const existing = await getFolders();
  if (existing.some((folder) => folder.name.toLowerCase() === trimmed.toLowerCase())) {
    return `You already have a folder called "${trimmed}".`;
  }
  return insertFolder(trimmed);
}
