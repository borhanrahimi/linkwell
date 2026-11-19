import "server-only";
import { connection } from "next/server";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { folders, links, rateLimits, user } from "@/db/schema";
import { toFolder, toLink } from "@/lib/links";
import {
  FOLDER_IMAGES,
  HOME_RECENT,
  HOME_REDISCOVER,
  HOME_UNREAD,
  makeCursor,
  PAGE_SIZE,
  readCursor,
  searchWords,
  type LinkPage,
  type LinkQuery,
  type LinkSummary,
} from "@/lib/linkQuery";
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

// ---- Lists a page at a time (v2.5) ----
// The rules are in lib/linkQuery.ts (matchesQuery, compareLinks); these
// follow them in SQL, so the database does the filtering, counting and
// sorting, and only one page of links travels to the browser.

const live = (userId: string) => and(eq(links.userId, userId), isNull(links.deletedAt));

// A search word inside LIKE: % and _ (and the escape character, \) are
// meant literally, not as wildcards.
function likeWord(word: string) {
  return `%${word.replace(/[\\%_]/g, "\\$&")}%`;
}

// Everything a link's search looks in, as one text: title, address, note, tags.
// (No search word has a space in it, so a space between them is enough.)
const searchText = sql`concat_ws(' ', ${links.title}, ${links.url}, ${links.note}, array_to_string(${links.tags}, ' '))`;

function queryWhere(userId: string, query: LinkQuery) {
  return and(
    live(userId),
    query.list === "unread" ? isNull(links.readAt) : undefined,
    query.list === "broken" ? eq(links.status, "broken") : undefined,
    query.list === "unsorted" ? isNull(links.folderId) : undefined,
    query.folderIds ? (query.folderIds.length > 0 ? inArray(links.folderId, query.folderIds) : sql`false`) : undefined,
    query.notInFolder ? sql`${links.folderId} is distinct from ${query.notInFolder}::uuid` : undefined,
    query.tag ? sql`${query.tag} = any(${links.tags})` : undefined,
    ...searchWords(query.search).map((word) => sql`${searchText} ilike ${likeWord(word)}`)
  );
}

// "Title (A–Z)" sorts by the title, or the site's name when there's none
// (lib/linkQuery.ts titleKey: the host without "www.").
// The host is the 3rd group of HOST: after "scheme://", an optional "www."
// and an optional "user@".
const HOST = String.raw`^[a-z][a-z0-9+.-]*://(www\.)?([^/:?#@]*@)?([^/:?#]*).*$`;
const titleKey = sql<string>`lower(coalesce(nullif(${links.title}, ''), regexp_replace(${links.url}, ${HOST}, ${String.raw`\3`}, 'i')))`;
// The sort key as text, for the cursor: exact to the microsecond for dates
// (a JavaScript date only keeps milliseconds, and would skip links).
function sortKey(query: LinkQuery) {
  return query.sort === "title" ? titleKey : sql<string>`${links.createdAt}::text`;
}

function orderFor(query: LinkQuery) {
  if (query.sort === "title") return [asc(titleKey), asc(links.id)];
  if (query.sort === "oldest") return [asc(links.createdAt), asc(links.id)];
  return [desc(links.createdAt), desc(links.id)];
}

// Keyset pagination: "after this link", not "skip 500 rows". The database
// jumps straight there through the index, however deep into the list.
function afterCursor(query: LinkQuery, cursor: string | null) {
  const after = readCursor(cursor);
  if (!after) return undefined;
  if (query.sort === "title") return sql`(${titleKey}, ${links.id}) > (${after.key}, ${after.id}::uuid)`;
  if (query.sort === "oldest") return sql`(${links.createdAt}, ${links.id}) > (${after.key}::timestamptz, ${after.id}::uuid)`;
  return sql`(${links.createdAt}, ${links.id}) < (${after.key}::timestamptz, ${after.id}::uuid)`;
}

export async function getLinkPage(userId: string, query: LinkQuery, cursor: string | null = null, limit = PAGE_SIZE): Promise<LinkPage> {
  const where = queryWhere(userId, query);
  const [rows, [{ total }]] = await db.batch([
    db
      .select({ link: links, key: sortKey(query) })
      .from(links)
      .where(and(where, afterCursor(query, cursor)))
      .orderBy(...orderFor(query))
      // One more than a page: if it's there, there is a next page.
      .limit(limit + 1),
    db.select({ total: sql<number>`count(*)::int` }).from(links).where(where),
  ]);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    links: page.map((row) => toLink(row.link)),
    total,
    next: rows.length > limit && last ? makeCursor(last.key, last.link.id) : null,
  };
}

// How many links a query finds.
export async function countMatching(userId: string, query: LinkQuery): Promise<number> {
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(links).where(queryWhere(userId, query));
  return total;
}

// Every link a query finds (Select all on a long list), up to `limit`.
export async function getAllMatching(userId: string, query: LinkQuery, limit: number): Promise<Link[]> {
  const rows = await db.select().from(links).where(queryWhere(userId, query)).orderBy(...orderFor(query)).limit(limit);
  return rows.map(toLink);
}

// The counts, tags and Home's few links, in one trip to the database (a
// batch). lib/linkQuery.ts summarize() is the same in memory.
export async function getLinkSummary(userId: string, now = new Date()): Promise<LinkSummary> {
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [[counts], folderRows, tagRows, imageRows, unreadRows, recentRows, rediscoverRows] = await db.batch([
    db
      .select({
        total: sql<number>`count(*)::int`,
        unread: sql<number>`(count(*) filter (where ${links.readAt} is null))::int`,
        broken: sql<number>`(count(*) filter (where ${links.status} = 'broken'))::int`,
        unsorted: sql<number>`(count(*) filter (where ${links.folderId} is null))::int`,
        thisWeek: sql<number>`(count(*) filter (where ${links.createdAt} > ${weekAgo}))::int`,
      })
      .from(links)
      .where(live(userId)),
    db
      .select({ folderId: links.folderId, count: sql<number>`count(*)::int` })
      .from(links)
      .where(and(live(userId), isNotNull(links.folderId)))
      .groupBy(links.folderId),
    db.execute<{ tag: string; count: number }>(sql`
      select tag, count(*)::int as count
      from ${links}, unnest(${links.tags}) as tag
      where ${links.userId} = ${userId} and ${links.deletedAt} is null
      group by tag
      order by count desc, tag`),
    // The newest few pictures in each folder: number each folder's links
    // newest first (row_number() over a "window"), keep the first few.
    db.execute<{ folder_id: string; image: string; created_at: string }>(sql`
      select folder_id, image, created_at from (
        select ${links.folderId} as folder_id, ${links.image} as image, ${links.createdAt} as created_at,
          row_number() over (partition by ${links.folderId} order by ${links.createdAt} desc, ${links.id} desc) as n
        from ${links}
        where ${links.userId} = ${userId} and ${links.deletedAt} is null
          and ${links.folderId} is not null and ${links.image} <> ''
      ) as pictures
      where n <= ${FOLDER_IMAGES}`),
    db.select().from(links).where(and(live(userId), isNull(links.readAt))).orderBy(desc(links.createdAt), desc(links.id)).limit(HOME_UNREAD),
    db.select().from(links).where(live(userId)).orderBy(desc(links.createdAt), desc(links.id)).limit(HOME_RECENT),
    db
      .select()
      .from(links)
      .where(and(live(userId), isNull(links.readAt), sql`${links.status} is distinct from 'broken'`, lt(links.createdAt, weekAgo)))
      .orderBy(asc(links.createdAt), asc(links.id))
      .limit(HOME_REDISCOVER),
  ]);
  const images: LinkSummary["images"] = {};
  for (const row of imageRows.rows) {
    (images[row.folder_id] ??= []).push({ image: row.image, createdAt: new Date(row.created_at).toISOString() });
  }
  return {
    ...counts,
    byFolder: Object.fromEntries(folderRows.map((row) => [row.folderId!, row.count])),
    tags: tagRows.rows,
    images,
    unreadLinks: unreadRows.map(toLink),
    recentLinks: recentRows.map(toLink),
    rediscoverLinks: rediscoverRows.map(toLink),
  };
}

// How many links the user has (not counting the Trash): for the link limit.
export async function countUserLinks(userId: string): Promise<number> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(links).where(live(userId));
  return count;
}

// Just the addresses of the user's links (not the Trash's), to spot a link
// saved twice: much less to send than whole links.
export async function getLinkUrls(userId: string): Promise<string[]> {
  const rows = await db.select({ url: links.url }).from(links).where(live(userId));
  return rows.map((row) => row.url);
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
    .orderBy(asc(folders.position), asc(folders.createdAt));
  return rows.map(toFolder);
}

// The next free position at the end of a level (null: the top level), worked
// out by the database in the same query that uses it.
function lastPosition(userId: string, parentId: string | null) {
  return sql`(select coalesce(max(f.position) + 1, 0) from ${folders} as f
    where f.user_id = ${userId} and f.parent_id is not distinct from ${parentId}::uuid and f.deleted_at is null)`;
}

// parentId: the folder to make it inside (already checked to be the user's
// own). A new folder goes last among the folders next to it.
export async function insertFolder(
  userId: string,
  name: string,
  color: FolderColor,
  parentId: string | null = null
): Promise<Folder> {
  const [row] = await db
    .insert(folders)
    .values({ userId, name, color, parentId, position: lastPosition(userId, parentId) })
    .returning();
  return toFolder(row);
}

// Moves a folder (with everything inside it) into another one, or to the top
// level with null, and saves the order of that level: `order` is every folder
// there, the moved one included, first to last. Moved to another folder by
// hand: restoring its old parent no longer takes it back. One batch.
export async function updateFolderPlace(userId: string, id: string, parentId: string | null, order: string[]) {
  const positions = sql.join(
    order.map((folderId, i) => sql`when ${folderId}::uuid then ${i}::integer`),
    sql` `
  );
  await db.batch([
    db
      .update(folders)
      .set({
        parentId,
        cameFromFolderId: sql`case when ${folders.parentId} is not distinct from ${parentId}::uuid then ${folders.cameFromFolderId} end`,
      })
      .where(ownFolder(userId, id)),
    db
      .update(folders)
      .set({ position: sql`case ${folders.id} ${positions} else ${folders.position} end` })
      .where(and(eq(folders.userId, userId), inArray(folders.id, order), isNull(folders.deletedAt))),
  ]);
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
    // They take its place in the order too (ties go by when they were made).
    db
      .update(folders)
      .set({ parentId, cameFromFolderId: id, position: sql`(select f.position from ${folders} as f where f.id = ${id})` })
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
// level if that's gone), last there, under a new name if its own is taken. Its
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
      .set({ deletedAt: null, name, parentId, position: lastPosition(userId, parentId) })
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
