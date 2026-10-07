import type { Link } from "@/types/link";

export const STORAGE_KEY = "linkwell:links";

export function createLink(url: string, title?: string, tags: string[] = []): Link {
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

export function saveLinks(links: Link[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

export function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function normalizeUrl(url: string) {
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

export function updateTitle(links: Link[], id: string, title: string): Link[] {
  return links.map((link) =>
    link.id === id ? { ...link, title: title.trim() || undefined } : link
  );
}

export function getFaviconUrl(url: string) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
}

export function parseTags(input: string): string[] {
  const tags = input
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag !== "");
  return [...new Set(tags)];
}

export function filterByTag(links: Link[], tag: string | null): Link[] {
  if (!tag){
    return links;
  }
  return links.filter((link) => link.tags?.includes(tag));
}


export function searchLinks(links: Link[], query: string): Link[] {
  const text = query.trim().toLowerCase();
  if (!text) {
    return links;
  }
  return links.filter(
    (link) =>
      link.url.toLowerCase().includes(text) ||
      link.title?.toLowerCase().includes(text)
  );
}


export type SortOrder = "newest" | "oldest" | "title";

export function sortLinks(links: Link[], order: SortOrder): Link[] {
  const sorted = [...links];
  if (order === "title") {
    return sorted.sort((a, b) =>
      (a.title || getDomain(a.url)).localeCompare(b.title || getDomain(b.url), "en", {
        sensitivity: "base",
      })
    );
  }
  sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return order === "oldest" ? sorted : sorted.reverse();
}