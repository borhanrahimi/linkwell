import type { Link } from "@/types/link";

export const STORAGE_KEY = "linkwell:links";

export function createLink(url: string, title?: string): Link {
  return {
    id: crypto.randomUUID(),
    url,
    title: title?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
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
