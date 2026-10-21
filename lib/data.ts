import "server-only";
import { connection } from "next/server";
import { and, asc, desc, eq, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { folders, links, rateLimits, user } from "@/db/schema";
import { toFolder, toLink } from "@/lib/links";
import type { Folder, FolderColor, FolderIcon, Link, LinkDetails, LinkStatus } from "@/types/link";

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
    folderId: link.folderId ?? null,
    createdAt: new Date(link.createdAt),
  });
}
// Many links in one INSERT: one trip to the database instead of hundreds.
export async function insertLinks(userId: string, newLinks: Link[]) {
  if (newLinks.length === 0) return;
  await db.insert(links).values(
    newLinks.map((link) => ({
      id: link.id,
      userId,
      url: link.url,
      title: link.title ?? null,
      tags: link.tags ?? [],
      folderId: link.folderId ?? null,
      createdAt: new Date(link.createdAt),
    }))
  );
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
  name: string,
  color: FolderColor
): Promise<Folder> {
  const [row] = await db.insert(folders).values({ userId, name, color }).returning();
  return toFolder(row);
}

export async function updateFolderName(
  userId: string,
  id: string,
  name: string
) {
  await db.update(folders).set({ name }).where(ownFolder(userId, id));
}

export async function updateFolderColor(
  userId: string,
  id: string,
  color: FolderColor
) {
  await db.update(folders).set({ color }).where(ownFolder(userId, id));
}

export async function updateFolderIcon(
  userId: string,
  id: string,
  icon: FolderIcon | null
) {
  await db.update(folders).set({ icon }).where(ownFolder(userId, id));
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

// Counts one more use of an action in a time window and returns the new
// total. One query: a new row with 1, or 1 added to the row that's there.
// Doing it in the database also works when two requests arrive at once.
export async function countAction(
  userId: string,
  action: string,
  windowStart: Date
): Promise<number> {
  const [row] = await db
    .insert(rateLimits)
    .values({ userId, action, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.userId, rateLimits.action, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  return row.count;
}

// Rate limit counts from windows that ended long ago are no longer needed.
export async function deleteOldRateLimits(before: Date) {
  await db.delete(rateLimits).where(lt(rateLimits.windowStart, before));
}

// For the health check: can the app reach the database at all? Touches no
// one's data, just asks the database to answer "1".
export async function isDatabaseUp(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
