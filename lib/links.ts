import type { Folder, Link, LinkDetails, LinkDetailsInput } from "@/types/link";
import type { FolderRow, LinkRow } from "@/db/schema";

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
export const NOTE_MAX_LENGTH = 500;

// Tidies what was typed in the Edit form, with the same rules as saving a new
// link: trimmed title, tags through parseTags, and a trimmed, length-limited
// note. Empty text becomes "no title" / "no note".
export function cleanDetails(input: LinkDetailsInput): LinkDetails {
  return {
    title: input.title.trim() || undefined,
    tags: parseTags(input.tags),
    note: input.note.trim().slice(0, NOTE_MAX_LENGTH) || undefined,
  };
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
  };
}

export function toFolder(row: FolderRow): Folder {
  return { id: row.id, name: row.name };
}

export function countLinks(links: Link[]) {
  return {
    total: links.length,
    unread: links.filter((link) => !link.readAt).length,
    broken: links.filter((link) => link.status === "broken").length,
  };
}
