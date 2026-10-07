"use server";

import {
  deleteLinkById,
  getLinks,
  insertLink,
  updateLinkStatus,
  updateLinkTitle,
} from "@/lib/data";
import { checkLink } from "@/lib/checkLink";
import { isDuplicate } from "@/lib/links";
import type { Link } from "@/types/link";

export async function saveLink(link: Link): Promise<string | null> {
  if (!link.url.trim()) {
    return "Please paste a link.";
  }
  if (isDuplicate(await getLinks(), link.url)) {
    return "You already saved this link!";
  }
  await insertLink(link);
  return null;
}

export async function removeLink(id: string) {
  await deleteLinkById(id);
}

export async function saveTitle(id: string, title: string) {
  await updateLinkTitle(id, title);
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
