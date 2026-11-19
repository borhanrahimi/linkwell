import { childFolders, folderAndInside, type TreeFolder } from "@/lib/folders";
import { countTags, getDomain, pickRediscover, type SmartList, type SortOrder } from "@/lib/links";
import type { Link } from "@/types/link";

// What one list on the links page asks for, and the few numbers and links
// the rest of the page needs (the sidebar's counts, Home). Since v2.5 the
// signed-in page doesn't load every link: the database answers these
// questions (lib/data.ts) and the browser loads a page of links at a time.
// The demo and the tests still keep every link in memory, and answer them
// with the functions here. These are the rules; the SQL in lib/data.ts
// follows them (and the browser test in e2e/scale.spec.ts checks it does).

// How many links one page of a list holds.
export const PAGE_SIZE = 50;

// The lists a query can ask for: Home with a tag chosen shows every link
// with that tag, so it's "all" here.
export type QueryList = "all" | "unread" | "broken" | "unsorted";

export type LinkQuery = {
  list: QueryList;
  // Only links in one of these folders (a folder, with the folders inside it
  // when those are included); null: any folder, or none.
  folderIds: string[] | null;
  // Only links that are not in this folder (Add links to a folder).
  notInFolder?: string | null;
  tag: string | null;
  // Words to look for in the title, address, note and tags.
  search: string;
  sort: SortOrder;
};

export const QUERY_LISTS: QueryList[] = ["all", "unread", "broken", "unsorted"];
const SORTS: SortOrder[] = ["newest", "oldest", "title"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SEARCH_MAX_LENGTH = 200;

// The list a page shows, from what's chosen in the address.
export function queryFor(
  folders: TreeFolder[],
  choice: { list: SmartList; folder: string | null; tag: string | null; withInside?: boolean; search?: string; sort?: SortOrder }
): LinkQuery {
  const list = QUERY_LISTS.includes(choice.list as QueryList) ? (choice.list as QueryList) : "all";
  const folderIds = choice.folder ? (choice.withInside ? [...folderAndInside(folders, choice.folder)] : [choice.folder]) : null;
  return { list, folderIds, tag: choice.tag, search: choice.search?.trim() ?? "", sort: choice.sort ?? "newest" };
}

// The list on screen, or null when the page shows something else: Home (with
// no tag chosen), the Folders screen or the Trash. A folder that doesn't
// exist (deleted, or an old bookmark) counts as no folder, as on the page.
export function shownQuery(
  folders: TreeFolder[],
  address: { list: SmartList; folder: string | null; tag: string | null },
  extras: { withInside?: boolean; search?: string; sort?: SortOrder } = {}
): LinkQuery | null {
  const folder = address.folder && folders.some((f) => f.id === address.folder) ? address.folder : null;
  if (!folder && (address.list === "folders" || address.list === "trash")) return null;
  if (!folder && address.list === "home" && !address.tag) return null;
  return queryFor(folders, { ...address, folder, ...extras });
}

// The same query as an address's search part (?list=unread&folder=…), for
// /api/links, and back. Reading it back never trusts it: anything odd falls
// back to the default, ids must be UUIDs, the text is cut to a sane length.
export function queryToParams(query: LinkQuery): URLSearchParams {
  const params = new URLSearchParams({ list: query.list, sort: query.sort });
  for (const id of query.folderIds ?? []) params.append("folder", id);
  if (query.folderIds?.length === 0) params.set("nofolders", "1");
  if (query.notInFolder) params.set("notin", query.notInFolder);
  if (query.tag) params.set("tag", query.tag);
  if (query.search) params.set("q", query.search);
  return params;
}

export function queryFromParams(params: URLSearchParams): LinkQuery {
  const list = params.get("list") as QueryList;
  const sort = params.get("sort") as SortOrder;
  const folders = params.getAll("folder").filter((id) => UUID.test(id)).slice(0, 1000);
  const notIn = params.get("notin");
  return {
    list: QUERY_LISTS.includes(list) ? list : "all",
    folderIds: folders.length > 0 ? folders : params.get("nofolders") ? [] : null,
    notInFolder: notIn && UUID.test(notIn) ? notIn : null,
    tag: params.get("tag")?.slice(0, 50) || null,
    search: (params.get("q") ?? "").trim().slice(0, SEARCH_MAX_LENGTH),
    sort: SORTS.includes(sort) ? sort : "newest",
  };
}

// One string per query, to tell when the list asks for something else.
export function queryKey(query: LinkQuery): string {
  return queryToParams(query).toString();
}

// The words of a search (at most 10), lower case.
export function searchWords(search: string): string[] {
  return search.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 10);
}

// Does a search find this link? Every word must be somewhere in its title,
// address, note or tags (ignoring case), so "rice saffron" finds "Saffron rice".
export function matchesSearch(link: Link, search: string): boolean {
  const words = searchWords(search);
  if (words.length === 0) return true;
  const text = [link.title ?? "", link.url, link.note ?? "", ...(link.tags ?? [])].join("\n").toLowerCase();
  return words.every((word) => text.includes(word));
}

export function matchesQuery(link: Link, query: LinkQuery): boolean {
  if (query.list === "unread" && link.readAt) return false;
  if (query.list === "broken" && link.status !== "broken") return false;
  if (query.list === "unsorted" && link.folderId) return false;
  if (query.folderIds && !(link.folderId && query.folderIds.includes(link.folderId))) return false;
  if (query.notInFolder && link.folderId === query.notInFolder) return false;
  if (query.tag && !link.tags?.includes(query.tag)) return false;
  return matchesSearch(link, query.search);
}

// What a link is sorted by for "Title (A–Z)": its title, or its site's name.
export function titleKey(link: Link): string {
  return (link.title || getDomain(link.url)).toLowerCase();
}

// Newest first, oldest first, or A to Z; ties go by id, so the order is the
// same every time (a page boundary can't skip or repeat a link).
export function compareLinks(a: Link, b: Link, sort: SortOrder): number {
  const byId = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  if (sort === "title") return titleKey(a).localeCompare(titleKey(b), "en", { sensitivity: "base" }) || byId;
  const byDate = a.createdAt.localeCompare(b.createdAt) || byId;
  return sort === "oldest" ? byDate : -byDate;
}

// Every link the query finds, in order: what the demo and the tests show.
export function queryLinks(links: Link[], query: LinkQuery): Link[] {
  return links.filter((link) => matchesQuery(link, query)).sort((a, b) => compareLinks(a, b, query.sort));
}

// ---- The summary: counts, tags and Home's few links ----

const WEEK = 7 * 24 * 60 * 60 * 1000;
export const HOME_UNREAD = 8;
export const HOME_RECENT = 6;
export const HOME_REDISCOVER = 10;
export const FOLDER_IMAGES = 4;

export type LinkSummary = {
  total: number;
  unread: number;
  broken: number;
  unsorted: number;
  // Saved in the 7 days before now.
  thisWeek: number;
  // How many links are in each folder itself (not counting folders inside).
  byFolder: Record<string, number>;
  tags: { tag: string; count: number }[];
  // The newest pictures of the links in each folder itself, for Home's tiles.
  images: Record<string, { image: string; createdAt: string }[]>;
  // The newest unread links, the newest links, and old unread ones to
  // rediscover (oldest first: saved over a week ago, not broken).
  unreadLinks: Link[];
  recentLinks: Link[];
  rediscoverLinks: Link[];
};

// now: left out (some tests), nothing counts as this week or as old.
export function summarize(links: Link[], now?: Date): LinkSummary {
  const newest = [...links].sort((a, b) => compareLinks(a, b, "newest"));
  const byFolder: Record<string, number> = {};
  const images: LinkSummary["images"] = {};
  for (const link of newest) {
    if (!link.folderId) continue;
    byFolder[link.folderId] = (byFolder[link.folderId] ?? 0) + 1;
    const pictures = (images[link.folderId] ??= []);
    if (link.image && pictures.length < FOLDER_IMAGES) pictures.push({ image: link.image, createdAt: link.createdAt });
  }
  const unread = newest.filter((link) => !link.readAt);
  return {
    total: links.length,
    unread: unread.length,
    broken: links.filter((link) => link.status === "broken").length,
    unsorted: links.filter((link) => !link.folderId).length,
    thisWeek: now ? links.filter((link) => now.getTime() - new Date(link.createdAt).getTime() < WEEK).length : 0,
    byFolder,
    tags: countTags(links),
    images: Object.fromEntries(Object.entries(images).filter(([, pictures]) => pictures.length > 0)),
    unreadLinks: unread.slice(0, HOME_UNREAD),
    recentLinks: newest.slice(0, HOME_RECENT),
    rediscoverLinks: now ? pickRediscover(links, now, HOME_REDISCOVER) : [],
  };
}

// Adds links the page didn't know yet. Links it knows are kept as they are:
// the page's own copy may hold a change the server hasn't finished saving.
export function addNewLinks(current: Link[], incoming: Link[]): Link[] {
  const known = new Set(current.map((link) => link.id));
  const fresh = incoming.filter((link) => !known.has(link.id) && known.add(link.id));
  return fresh.length > 0 ? [...current, ...fresh] : current;
}

// The summary's links as the page has them now, so Home shows a change at
// once (a link marked read leaves Unread) instead of after the next summary.
export function liveSummary(summary: LinkSummary, links: Link[]): LinkSummary {
  const byId = new Map(links.map((link) => [link.id, link]));
  const now = (items: Link[]) => items.map((link) => byId.get(link.id)).filter((link): link is Link => link !== undefined);
  return {
    ...summary,
    unreadLinks: now(summary.unreadLinks).filter((link) => !link.readAt),
    recentLinks: now(summary.recentLinks),
    rediscoverLinks: now(summary.rediscoverLinks).filter((link) => !link.readAt && link.status !== "broken"),
  };
}

// A link just saved, counted at once (the server's summary comes a moment
// later): so the page never says "No links yet" next to it.
export function withNewLink(summary: LinkSummary, link: Link): LinkSummary {
  return {
    ...summary,
    total: summary.total + 1,
    unread: summary.unread + (link.readAt ? 0 : 1),
    unsorted: summary.unsorted + (link.folderId ? 0 : 1),
    thisWeek: summary.thisWeek + 1,
    byFolder: link.folderId ? { ...summary.byFolder, [link.folderId]: (summary.byFolder[link.folderId] ?? 0) + 1 } : summary.byFolder,
    unreadLinks: link.readAt ? summary.unreadLinks : [link, ...summary.unreadLinks].slice(0, HOME_UNREAD),
    recentLinks: [link, ...summary.recentLinks].slice(0, HOME_RECENT),
  };
}

// A folder tile's pictures: the newest of the links in it and in the folders inside it.
export function imagesInside<F extends TreeFolder>(folders: F[], images: LinkSummary["images"], id: string): string[] {
  return [...folderAndInside(folders, id)]
    .flatMap((inside) => images[inside] ?? [])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, FOLDER_IMAGES)
    .map((picture) => picture.image);
}

// Home's top-level folders, pinned ones first.
export function homeFolders<F extends TreeFolder & { pinned?: boolean }>(folders: F[]): F[] {
  return childFolders(folders, null).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
}

// ---- Pages ----

// Where the next page starts: just after this link, in the list's order.
// The browser sends it back as it got it; the server reads it again
// (readCursor) and starts from the beginning if it's odd.
export type Cursor = { key: string; id: string };

// key: what the list is sorted by, as the database wrote it (the date to the
// microsecond, or the title key).
export function makeCursor(key: string, id: string): string {
  return JSON.stringify([key, id]);
}

export function readCursor(value: string | null): Cursor | null {
  if (!value || value.length > 2000) return null;
  try {
    const [key, id] = JSON.parse(value);
    if (typeof key !== "string" || typeof id !== "string" || !UUID.test(id)) return null;
    return { key, id };
  } catch {
    return null;
  }
}

// One page of a list, as /api/links sends it.
export type LinkPage = {
  links: Link[];
  // How many links the whole list has.
  total: number;
  // Ask with this for the next page; null at the end.
  next: string | null;
};
