import type { Folder, Link, LinkDetails, LinkDetailsInput } from "@/types/link";
import type { FolderRow, LinkRow } from "@/db/schema";
import { isFolderColor, isFolderIcon } from "@/lib/folders";

export const STORAGE_KEY = "linkwell:links";

export function createLink(
  url: string,
  title?: string,
  tags: string[] = []
): Link {
  return {
    id: crypto.randomUUID(),
    url,
    title: title?.trim() || undefined,
    tags,
    createdAt: new Date().toISOString(),
  };
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(isoDate: string, now = new Date()) {
  const seconds = (now.getTime() - new Date(isoDate).getTime()) / 1000;

  for (const [unit, size] of UNITS) {
    if (seconds >= size) {
      return relativeTime.format(-Math.floor(seconds / size), unit);
    }
  }
  return "just now";
}

export function loadLinks(): Link[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Link[]) : [];
  } catch {
    return [];
  }
}

export function clearSavedLinks() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function normalizeUrl(url: string) {
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
}

export function isDuplicate(links: Link[], url: string) {
  const target = normalizeUrl(url);
  return links.some((link) => normalizeUrl(link.url) === target);
}

export function setReadAt(
  links: Link[],
  id: string,
  readAt: string | undefined
): Link[] {
  return links.map((link) => (link.id === id ? { ...link, readAt } : link));
}
// Limits for everything saved about a link. Server Actions are public, so the
// server enforces them whatever the browser sends; forms use them as
// maxLength too, so people see the limit while typing.
export const URL_MAX_LENGTH = 2048;
export const TITLE_MAX_LENGTH = 500;
export const NOTE_MAX_LENGTH = 500;
export const TAG_MAX_LENGTH = 50;
export const TAGS_MAX = 20;
export const FOLDER_NAME_MAX_LENGTH = 100;

// Text from the browser, or "" for anything that isn't text (a number, an
// object, nothing at all), so the checks below never crash on odd input.
export function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// Trimmed and cut to maxLength; empty text becomes undefined.
export function cleanText(value: unknown, maxLength: number): string | undefined {
  return textOf(value).trim().slice(0, maxLength) || undefined;
}

// Only http and https addresses: never javascript:, data: or file: links.
export function isWebAddress(url: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

// Tags from a form's comma-separated text, or from a list (imports): through
// parseTags, each cut to TAG_MAX_LENGTH, at most TAGS_MAX.
export function cleanTags(input: unknown): string[] {
  const text = Array.isArray(input) ? input.filter((tag) => typeof tag === "string").join(",") : textOf(input);
  return [...new Set(parseTags(text).map((tag) => tag.slice(0, TAG_MAX_LENGTH)))].slice(0, TAGS_MAX);
}

// A real date that isn't in the future, as an ISO string; otherwise undefined.
export function cleanDate(value: unknown, now = new Date()): string | undefined {
  const date = new Date(textOf(value));
  return !isNaN(date.getTime()) && date <= now ? date.toISOString() : undefined;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The most links one bulk action (Select → Move, Add links to a folder) takes.
export const BULK_MAX = 500;

// Link ids sent from the browser for a bulk action: only real ids (UUIDs),
// each once, at most BULK_MAX. Anything else is dropped, never trusted.
export function cleanIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const ids = input.filter((id): id is string => typeof id === "string" && UUID.test(id));
  return [...new Set(ids)].slice(0, BULK_MAX);
}

// Checks a new link the browser sends (saveLink, importLinks). Returns the
// cleaned link, or a message saying what's wrong. Only the fields a new link
// may have are kept: the browser can't set a status, a read date or a folder.
export function cleanNewLink(input: Link, now = new Date()): Link | string {
  const url = textOf(input?.url).trim();
  if (!url) {
    return "Please paste a link.";
  }
  if (url.length > URL_MAX_LENGTH) {
    return "That link is too long.";
  }
  if (!isWebAddress(url)) {
    return "Only web links (starting with http:// or https://) can be saved.";
  }
  return {
    // The browser makes the id, so the card can show at once; anything that
    // isn't a real UUID gets a new one.
    id: UUID.test(textOf(input.id)) ? input.id : crypto.randomUUID(),
    url,
    title: cleanText(input.title, TITLE_MAX_LENGTH),
    tags: cleanTags(input.tags),
    createdAt: cleanDate(input.createdAt, now) ?? now.toISOString(),
  };
}

// Tidies what was typed in the Edit form, with the same rules as saving a new
// link. Empty text becomes "no title" / "no note".
export function cleanDetails(input: LinkDetailsInput): LinkDetails {
  return {
    title: cleanText(input?.title, TITLE_MAX_LENGTH),
    tags: cleanTags(input?.tags),
    note: cleanText(input?.note, NOTE_MAX_LENGTH),
  };
}

// A folder's name, trimmed, or a message saying what's wrong.
export function cleanFolderName(input: unknown): { name: string } | { error: string } {
  const name = textOf(input).trim();
  if (!name) {
    return { error: "Please give the folder a name." };
  }
  if (name.length > FOLDER_NAME_MAX_LENGTH) {
    return { error: `Folder names can be at most ${FOLDER_NAME_MAX_LENGTH} characters.` };
  }
  return { name };
}

export function updateDetails(
  links: Link[],
  id: string,
  details: LinkDetails
): Link[] {
  return links.map((link) => (link.id === id ? { ...link, ...details } : link));
}

export function setFolder(
  links: Link[],
  id: string,
  folderId: string | undefined
): Link[] {
  return links.map((link) => (link.id === id ? { ...link, folderId } : link));
}

export function clearFolder(links: Link[], folderId: string): Link[] {
  return links.map((link) =>
    link.folderId === folderId ? { ...link, folderId: undefined } : link
  );
}

const WEEK = 7 * 24 * 60 * 60 * 1000;

export function pickRediscover(links: Link[], now: Date, count = 3): Link[] {
  return links
    .filter((link) => !link.readAt && link.status !== "broken")
    .filter((link) => now.getTime() - new Date(link.createdAt).getTime() > WEEK)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, count);
}

export function getFaviconUrl(url: string) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return null;
  }
}
export function getArchiveUrl(url: string) {
  return `https://web.archive.org/web/${url}`;
}

export function parseTags(input: string): string[] {
  const tags = input
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag !== "");
  return [...new Set(tags)];
}

export function filterByTag(links: Link[], tag: string | null): Link[] {
  if (!tag) {
    return links;
  }
  return links.filter((link) => link.tags?.includes(tag));
}

export function filterByFolder(links: Link[], folderId: string | null): Link[] {
  if (!folderId) {
    return links;
  }
  return links.filter((link) => link.folderId === folderId);
}

export function searchLinks(links: Link[], query: string): Link[] {
  const text = query.trim().toLowerCase();
  if (!text) {
    return links;
  }
  return links.filter(
    (link) =>
      link.url.toLowerCase().includes(text) ||
      link.title?.toLowerCase().includes(text) ||
      link.note?.toLowerCase().includes(text)
  );
}

export type SortOrder = "newest" | "oldest" | "title";

export function sortLinks(links: Link[], order: SortOrder): Link[] {
  const sorted = [...links];
  if (order === "title") {
    return sorted.sort((a, b) =>
      (a.title || getDomain(a.url)).localeCompare(
        b.title || getDomain(b.url),
        "en",
        {
          sensitivity: "base",
        }
      )
    );
  }
  sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return order === "oldest" ? sorted : sorted.reverse();
}

export function toLink(row: LinkRow): Link {
  return {
    id: row.id,
    url: row.url,
    title: row.title ?? undefined,
    note: row.note ?? undefined,
    tags: row.tags,
    createdAt: row.createdAt.toISOString(),
    status: row.status ?? undefined,
    checkedAt: row.checkedAt?.toISOString(),
    readAt: row.readAt?.toISOString(),
    folderId: row.folderId ?? undefined,
    // "" means the page had none: the same as no picture, for the app.
    image: row.image || undefined,
  };
}

export function toFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    name: row.name,
    color: isFolderColor(row.color) ? row.color : undefined,
    icon: isFolderIcon(row.icon) ? row.icon : undefined,
  };
}

export function countLinks(links: Link[]) {
  return {
    total: links.length,
    unread: links.filter((link) => !link.readAt).length,
    broken: links.filter((link) => link.status === "broken").length,
  };
}

// The sidebar's smart lists.
export type SmartList = "all" | "unread" | "broken";

export function filterByList(links: Link[], list: SmartList): Link[] {
  if (list === "unread") return links.filter((link) => !link.readAt);
  if (list === "broken") return links.filter((link) => link.status === "broken");
  return links;
}

// Every tag in use, with how many links have it: most used first, then A to Z.
export function countTags(links: Link[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const link of links) {
    for (const tag of link.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
