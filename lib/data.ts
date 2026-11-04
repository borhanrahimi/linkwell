import "server-only";
import { connection } from "next/server";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { folders, links, rateLimits, user } from "@/db/schema";
import { toFolder, toLink } from "@/lib/links";
import type { Folder, FolderColor, FolderIcon, Link, LinkDetails, LinkStatus } from "@/types/link";

// Every function takes the signed-in user's id and only touches that user's rows.
// Updates and deletes match on id AND user_id, so a guessed id from someone
// else's account changes nothing.
//
// Things in the Trash have a deleted_at. Everything here leaves them alone,
// except the Trash's own functions further down.

function ownLink(userId: string, id: string) {
  return and(eq(links.id, id), eq(links.userId, userId), isNull(links.deletedAt));
}

function ownLinks(userId: string, ids: string[]) {
  return and(eq(links.userId, userId), inArray(links.id, ids), isNull(links.deletedAt));
}

function ownFolder(userId: string, id: string) {
  return and(eq(folders.id, id), eq(folders.userId, userId), isNull(folders.deletedAt));
}

export async function getLinks(userId: string): Promise<Link[]> {
  await connection();
  const rows = await db
    .select()
    .from(links)
    .where(and(eq(links.userId, userId), isNull(links.deletedAt)))
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
    // null: not looked for yet (a picture may follow, see updateLinkImage).
    image: link.image ?? null,
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
  // Moved by hand: restoring its old folder no longer takes it back.
  await db.update(links).set({ folderId, cameFromFolderId: null }).where(ownLink(userId, id));
}

// Bulk versions, for Select mode and "Add links" in a folder. They still only
// touch the user's own links: ids from someone else's account match nothing.
export async function updateLinksFolder(userId: string, ids: string[], folderId: string | null) {
  if (ids.length === 0) return;
  await db.update(links).set({ folderId, cameFromFolderId: null }).where(ownLinks(userId, ids));
}

export async function updateLinksReadAt(userId: string, ids: string[], readAt: Date | null) {
  if (ids.length === 0) return;
  await db.update(links).set({ readAt }).where(ownLinks(userId, ids));
}

export async function getFolders(userId: string): Promise<Folder[]> {
  const rows = await db
    .select()
    .from(folders)
    .where(and(eq(folders.userId, userId), isNull(folders.deletedAt)))
    .orderBy(asc(folders.createdAt));
  return rows.map(toFolder);
}

// parentId: the folder to make it inside (already checked to be the user's own).
export async function insertFolder(
  userId: string,
  name: string,
  color: FolderColor,
  parentId: string | null = null
): Promise<Folder> {
  const [row] = await db.insert(folders).values({ userId, name, color, parentId }).returning();
  return toFolder(row);
}

// Moves a folder (with everything inside it) into another one, or to the top
// level with null. Moved by hand: restoring its old parent no longer takes it back.
export async function updateFolderParent(userId: string, id: string, parentId: string | null) {
  await db.update(folders).set({ parentId, cameFromFolderId: null }).where(ownFolder(userId, id));
}

// The ids of the folders this one is inside, nearest first, found by the
// database itself: WITH RECURSIVE starts at the folder and keeps following
// parent_id up until the top. "depth < 1000" stops it if a loop ever sneaks in.
export async function getFolderAncestors(userId: string, id: string): Promise<string[]> {
  const result = await db.execute<{ id: string }>(sql`
    with recursive up as (
      select ${folders.parentId} as id, 1 as depth
      from ${folders}
      where ${folders.id} = ${id} and ${folders.userId} = ${userId}
      union all
      select f.parent_id, up.depth + 1
      from up join ${folders} f on f.id = up.id
      where up.depth < 1000
    )
    select id from up where id is not null
  `);
  return result.rows.map((row) => row.id);
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

export async function updateFolderPinned(userId: string, id: string, pinned: boolean) {
  await db.update(folders).set({ pinnedAt: pinned ? new Date() : null }).where(ownFolder(userId, id));
}

// ---- The Trash ----

export async function getTrash(userId: string): Promise<{ links: Link[]; folders: Folder[] }> {
  const [linkRows, folderRows] = await Promise.all([
    db
      .select()
      .from(links)
      .where(and(eq(links.userId, userId), isNotNull(links.deletedAt)))
      .orderBy(desc(links.deletedAt)),
    db
      .select()
      .from(folders)
      .where(and(eq(folders.userId, userId), isNotNull(folders.deletedAt)))
      .orderBy(desc(folders.deletedAt)),
  ]);
  return { links: linkRows.map(toLink), folders: folderRows.map(toFolder) };
}

export async function trashLinks(userId: string, ids: string[]) {
  if (ids.length === 0) return;
  await db.update(links).set({ deletedAt: new Date() }).where(ownLinks(userId, ids));
}

// A folder goes to the Trash; what's inside it doesn't. Its links and the
// folders inside it move up one level, into its parent (or the top level),
// and remember it in came_from_folder_id. `renames`: folders that would clash
// with a name already up there get a free one. All in one batch: one transaction.
export async function trashFolder(
  userId: string,
  id: string,
  parentId: string | null,
  renames: { id: string; name: string }[] = []
) {
  await db.batch([
    db
      .update(links)
      .set({ folderId: parentId, cameFromFolderId: id })
      .where(and(eq(links.userId, userId), eq(links.folderId, id), isNull(links.deletedAt))),
    db
      .update(folders)
      .set({ parentId, cameFromFolderId: id })
      .where(and(eq(folders.userId, userId), eq(folders.parentId, id), isNull(folders.deletedAt))),
    ...renames.map((rename) => db.update(folders).set({ name: rename.name }).where(ownFolder(userId, rename.id))),
    db.update(folders).set({ deletedAt: new Date() }).where(ownFolder(userId, id)),
  ]);
}

// Out of the Trash. A link whose folder is in the Trash too (or gone) comes
// back with no folder.
export async function restoreLinks(userId: string, ids: string[]): Promise<Link[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .update(links)
    .set({
      deletedAt: null,
      folderId: sql`(select ${folders.id} from ${folders} where ${folders.id} = ${links.folderId} and ${folders.deletedAt} is null)`,
    })
    .where(and(eq(links.userId, userId), inArray(links.id, ids), isNotNull(links.deletedAt)))
    .returning();
  return rows.map(toLink);
}

// A folder out of the Trash, into `parentId` (its old parent, or the top
// level if that's gone), under a new name if its own is taken there now. Its
// links and folders come back only if they're still where deleting it put
// them: in `movedTo`, the parent it had when it was deleted.
export async function restoreFolder(
  userId: string,
  id: string,
  name: string,
  parentId: string | null,
  movedTo: string | null
): Promise<Folder | null> {
  const [folderRows] = await db.batch([
    db
      .update(folders)
      .set({ deletedAt: null, name, parentId })
      .where(and(eq(folders.id, id), eq(folders.userId, userId), isNotNull(folders.deletedAt)))
      .returning(),
    db
      .update(links)
      .set({ folderId: id, cameFromFolderId: null })
      .where(
        and(
          eq(links.userId, userId),
          eq(links.cameFromFolderId, id),
          movedTo ? eq(links.folderId, movedTo) : isNull(links.folderId),
          sql`exists (select 1 from ${folders} where ${folders.id} = ${id} and ${folders.deletedAt} is null)`
        )
      ),
    db
      .update(folders)
      .set({ parentId: id, cameFromFolderId: null })
      .where(
        and(
          eq(folders.userId, userId),
          eq(folders.cameFromFolderId, id),
          movedTo ? eq(folders.parentId, movedTo) : isNull(folders.parentId),
          isNull(folders.deletedAt),
          sql`exists (select 1 from ${folders} as f where f.id = ${id} and f.deleted_at is null)`
        )
      ),
  ]);
  return folderRows[0] ? toFolder(folderRows[0]) : null;
}

// Gone for good: only things already in the Trash.
export async function deleteForever(userId: string, linkIds: string[], folderIds: string[]) {
  await db.batch([
    db
      .delete(links)
      .where(and(eq(links.userId, userId), inArray(links.id, linkIds), isNotNull(links.deletedAt))),
    db
      .delete(folders)
      .where(and(eq(folders.userId, userId), inArray(folders.id, folderIds), isNotNull(folders.deletedAt))),
  ]);
}

export async function emptyTrash(userId: string) {
  await db.batch([
    db.delete(links).where(and(eq(links.userId, userId), isNotNull(links.deletedAt))),
    db.delete(folders).where(and(eq(folders.userId, userId), isNotNull(folders.deletedAt))),
  ]);
}

// For the daily job: everything, of every user, that has been in the Trash
// since before `before`. Returns how many things were deleted.
export async function deleteOldTrash(before: Date): Promise<number> {
  const [oldLinks, oldFolders] = await db.batch([
    db.delete(links).where(lt(links.deletedAt, before)).returning({ id: links.id }),
    db.delete(folders).where(lt(folders.deletedAt, before)).returning({ id: folders.id }),
  ]);
  return oldLinks.length + oldFolders.length;
}

// The link in the Trash with one of these addresses, if there is one: saving
// it again offers to restore it instead of making a copy.
export async function findTrashedLink(userId: string, urls: string[]): Promise<Link | undefined> {
  const [row] = await db
    .select()
    .from(links)
    .where(and(eq(links.userId, userId), inArray(links.url, urls), isNotNull(links.deletedAt)))
    .limit(1);
  return row ? toLink(row) : undefined;
}
// Every user's links, for the daily check that Vercel Cron runs.
// The only function here without a userId: never call it from a Server Action.
// The page's sharing picture once it's been looked for: its address, or ""
// when the page has none (so it isn't looked for again).
export async function updateLinkImage(userId: string, id: string, image: string) {
  await db.update(links).set({ image }).where(ownLink(userId, id));
}

// For the daily job: links, of every user, whose picture hasn't been looked
// for yet (saved before pictures existed), a batch at a time.
export async function getLinksWithoutImage(limit: number): Promise<{ id: string; userId: string; url: string }[]> {
  return db
    .select({ id: links.id, userId: links.userId, url: links.url })
    .from(links)
    .where(and(sql`${links.image} is null`, sql`${links.status} is distinct from 'broken'`, isNull(links.deletedAt)))
    .limit(limit);
}

export async function getLinksToCheck(): Promise<
  { id: string; userId: string; url: string }[]
> {
  return db
    .select({ id: links.id, userId: links.userId, url: links.url })
    .from(links)
    .where(isNull(links.deletedAt));
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
