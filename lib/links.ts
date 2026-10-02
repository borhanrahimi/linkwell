import type { Link } from "@/types/link";

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
