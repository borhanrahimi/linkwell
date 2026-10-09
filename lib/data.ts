import "server-only";
import { connection } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { folders, links } from "@/db/schema";
import { toFolder, toLink } from "@/lib/links";
import type { Folder, Link, LinkStatus } from "@/types/link";

export async function getLinks(): Promise<Link[]> {
  await connection();
  const rows = await db.select().from(links).orderBy(desc(links.createdAt));
  return rows.map(toLink);
}

export async function insertLink(link: Link) {
  await db.insert(links).values({
    id: link.id,
    url: link.url,
    title: link.title ?? null,
    tags: link.tags ?? [],
    createdAt: new Date(link.createdAt),
  });
}

export async function deleteLinkById(id: string) {
  await db.delete(links).where(eq(links.id, id));
}

export async function updateLinkTitle(id: string, title: string) {
  await db
    .update(links)
    .set({ title: title.trim() || null })
    .where(eq(links.id, id));
}

export async function updateLinkStatus(id: string, status: LinkStatus) {
  await db
    .update(links)
    .set({ status, checkedAt: new Date() })
    .where(eq(links.id, id));
}

export async function updateLinkReadAt(id: string, readAt: Date | null) {
  await db.update(links).set({ readAt }).where(eq(links.id, id));
}

export async function getFolders(): Promise<Folder[]> {
  const rows = await db.select().from(folders).orderBy(asc(folders.createdAt));
  return rows.map(toFolder);
}

export async function insertFolder(name: string): Promise<Folder> {
  const [row] = await db.insert(folders).values({ name }).returning();
  return toFolder(row);
}