import type { Link } from "@/types/link";

export function createLink(url: string): Link {
  return {
    id: Date.now(),
    url,
    createdAt: new Date().toLocaleString(),
  };
}
