import type { Link } from "@/types/link";

export const STORAGE_KEY = "linkwell:links";

export function createLink(url: string): Link {
  return {
    id: crypto.randomUUID(),
    url,
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