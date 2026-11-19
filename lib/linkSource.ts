import { queryToParams, type LinkPage, type LinkQuery, type LinkSummary } from "@/lib/linkQuery";
import type { Link } from "@/types/link";

// How the signed-in links page asks the server for links (v2.5): a page of a
// list at a time, every link of a list (Select all), how many a list has,
// and the summary (counts, tags, Home's links). Through /api/links: plain GET
// requests, so a search that's out of date can be cancelled (signal).
// Tests hand LinkManager a fake one; the demo doesn't need one.
export type LinkSource = {
  page: (query: LinkQuery, after: string | null, signal?: AbortSignal) => Promise<LinkPage>;
  all: (query: LinkQuery) => Promise<Link[]>;
  count: (query: LinkQuery) => Promise<number>;
  summary: () => Promise<LinkSummary>;
};

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
  return response.json();
}

function address(query: LinkQuery, extra: Record<string, string> = {}) {
  const params = queryToParams(query);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return `/api/links?${params}`;
}

export const SERVER_SOURCE: LinkSource = {
  page: (query, after, signal) => get(address(query, after ? { after } : {}), signal),
  all: async (query) => (await get<{ links: Link[] }>(address(query, { all: "1" }))).links,
  count: async (query) => (await get<{ total: number }>(address(query, { count: "1" }))).total,
  summary: () => get("/api/links/summary"),
};
