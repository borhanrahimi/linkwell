"use server";

import { deleteLinkById, getLinks, insertLink, updateLinkTitle } from "@/lib/data";
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
