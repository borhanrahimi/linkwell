import "server-only";
import { connection } from "next/server";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { folders, links, user } from "@/db/schema";
import { toFolder, toLink } from "@/lib/links";
import type { Folder, Link, LinkDetails, LinkStatus } from "@/types/link";

// Every function takes the signed-in user's id and only touches that user's rows.
// Updates and deletes match on id AND user_id, so a guessed id from someone
// else's account changes nothing.

function ownLink(userId: string, id: string) {
  return and(eq(links.id, id), eq(links.userId, userId));
}

function ownFolder(userId: string, id: string) {
  return and(eq(folders.id, id), eq(folders.userId, userId));
}

export async function getLinks(userId: string): Promise<Link[]> {
  await connection();
  const rows = await db
    .select()
    .from(links)
    .where(eq(links.userId, userId))
    .orderBy(desc(links.createdAt));
  return rows.map(toLink);
}

export async function insertLink(userId: string, link: Link) {
  await db.insert(links).values({
    id: link.id,
    userId,
    url: link.url,
    title: link.title ?? null,
    tags: link.tags ?? [],
    createdAt: new Date(link.createdAt),
  });
}

export async function deleteLinkById(userId: string, id: string) {
  await db.delete(links).where(ownLink(userId, id));
}

export async function updateLinkStatus(
  userId: string,
  id: string,
  status: LinkStatus
) {
  await db
    .update(links)
    .set({ status, checkedAt: new Date() })
    .where(ownLink(userId, id));
}
export async function updateLinkDetails(
  userId: string,
  id: string,
  details: LinkDetails
) {
  await db
    .update(links)
    .set({
      title: details.title ?? null,
      tags: details.tags,
      note: details.note ?? null,
    })
    .where(ownLink(userId, id));
}

export async function updateLinkReadAt(
  userId: string,
  id: string,
  readAt: Date | null
) {
  await db.update(links).set({ readAt }).where(ownLink(userId, id));
}

export async function updateLinkFolder(
  userId: string,
  id: string,
  folderId: string | null
) {
  await db.update(links).set({ folderId }).where(ownLink(userId, id));
}

export async function getFolders(userId: string): Promise<Folder[]> {
  const rows = await db
    .select()
    .from(folders)
    .where(eq(folders.userId, userId))
    .orderBy(asc(folders.createdAt));
  return rows.map(toFolder);
}

export async function insertFolder(
  userId: string,
  name: string
): Promise<Folder> {
  const [row] = await db.insert(folders).values({ userId, name }).returning();
  return toFolder(row);
}

export async function updateFolderName(
  userId: string,
  id: string,
  name: string
) {
  await db.update(folders).set({ name }).where(ownFolder(userId, id));
}

export async function deleteFolderById(userId: string, id: string) {
  await db.delete(folders).where(ownFolder(userId, id));
}
// Every user's links, for the daily check that Vercel Cron runs.
// The only function here without a userId: never call it from a Server Action.
export async function getLinksToCheck(): Promise<
  { id: string; userId: string; url: string }[]
> {
  return db
    .select({ id: links.id, userId: links.userId, url: links.url })
    .from(links);
}

// True when someone other than this user already has the username.
export async function isUsernameTaken(
  userId: string,
  username: string
): Promise<boolean> {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.username, username), ne(user.id, userId)))
    .limit(1);
  return rows.length > 0;
}

export async function updateUsername(userId: string, username: string) {
  await db.update(user).set({ username }).where(eq(user.id, userId));
}
