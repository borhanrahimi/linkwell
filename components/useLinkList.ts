import { useEffect, useRef, useState } from "react";
import { matchesQuery, PAGE_SIZE, queryFromParams, queryKey, queryLinks, type LinkPage, type LinkQuery } from "@/lib/linkQuery";
import type { LinkSource } from "@/lib/linkSource";
import type { Link } from "@/types/link";

// The list on the links page, PAGE_SIZE links at a time (v2.5).
//
// - Local (the demo and tests, which have every link): the list is worked out
//   from `links` on each render, and drawn PAGE_SIZE more at a time.
// - Server (signed in): the page has only some links. This keeps the ids of
//   the pages loaded so far (the links themselves go into `links`, the one
//   place the page keeps them, through `learn`), and asks for the next page near the end.
//   The links are checked against the query again on each render, so a
//   change shows at once (a link marked read leaves Unread) before the
//   server is asked again.
type Loaded = {
  // What was asked: the query's key, and how many times it was reloaded.
  want: string;
  query: LinkQuery;
  ids: string[];
  total: number;
  next: string | null;
  failed?: boolean;
};

export type LinkList = {
  // What to draw now, in order.
  links: Link[];
  // How many the whole list has.
  total: number;
  hasMore: boolean;
  // "new": a different list is on its way (draw a placeholder); "update":
  // the same list with another search, sort or reload (keep the old one).
  loading: "new" | "update" | null;
  failed: boolean;
  loadMore: () => void;
  // Ask the server again, from the top (after something may have joined the list).
  reload: () => void;
  // Ask how many links the list has now (after some left it).
  refreshCount: () => void;
  // A link just saved: at the top of the list, if the list is newest first.
  addNewest: (link: Link) => void;
  // Every link of the list, for Select all: at once when the page has them
  // all, or after asking the server for the rest.
  allIds: () => string[] | Promise<string[]>;
  // Is this link one of the list's? (Local: always, the list is worked out anew.)
  has: (id: string) => boolean;
};

const searchless = (query: LinkQuery) => queryKey({ ...query, search: "", sort: "newest" });
const baseOf = (key: string) => searchless(queryFromParams(new URLSearchParams(key)));

export function useLinkList({
  server,
  query,
  links,
  learn,
  source,
  initial,
}: {
  server: boolean;
  query: LinkQuery | null;
  links: Link[];
  // Hands the links that came from the server to the page (see LinkManager).
  learn: (incoming: Link[]) => void;
  source: LinkSource;
  initial?: { key: string; page: LinkPage } | null;
}): LinkList {
  const key = query ? queryKey(query) : null;

  // ---- Local: how many are drawn, for this query (a new one starts again) ----
  const [shown, setShown] = useState({ key, count: PAGE_SIZE });
  const drawn = shown.key === key ? shown.count : PAGE_SIZE;

  // ---- Server: the pages loaded so far ----
  // Each visit to a list (and each reload) is asked for anew: coming back to
  // a list after changes elsewhere (a link restored from the Trash) never
  // shows the pages from the last visit.
  // `keep`: the list on screen stays while the new answer comes (the same
  // list with another search or sort, or a reload); otherwise it's a new one.
  const [visit, setVisit] = useState({ key, n: 0, keep: false });
  if (visit.key !== key) {
    const sameList = visit.key !== null && key !== null && baseOf(visit.key) === baseOf(key);
    setVisit({ key, n: visit.n + 1, keep: sameList });
  }
  const reload = () => setVisit((now) => ({ ...now, n: now.n + 1, keep: true }));
  const want = key === null ? null : `${key}#${visit.n}`;
  const [list, setList] = useState<Loaded | null>(() =>
    initial
      ? {
          want: `${initial.key}#0`,
          query: queryFromParams(new URLSearchParams(initial.key)),
          ids: initial.page.links.map((link) => link.id),
          total: initial.page.total,
          next: initial.page.next,
        }
      : null
  );
  const loadedWant = list?.want ?? null;

  useEffect(() => {
    if (!server || want === null || loadedWant === want) return;
    // Only the newest question's answer is used: an older one is cancelled.
    const controller = new AbortController();
    const asked = queryFromParams(new URLSearchParams(want.slice(0, want.lastIndexOf("#"))));
    source.page(asked, null, controller.signal).then(
      (page) => {
        learn(page.links);
        setList({ want, query: asked, ids: page.links.map((link) => link.id), total: page.total, next: page.next });
      },
      () => {
        if (!controller.signal.aborted) setList({ want, query: asked, ids: [], total: 0, next: null, failed: true });
      }
    );
    return () => controller.abort();
  }, [server, want, loadedWant, source, learn]);

  const loadingMore = useRef(false);

  if (!server) {
    const all = query ? queryLinks(links, query) : [];
    return {
      links: all.slice(0, drawn),
      total: all.length,
      hasMore: drawn < all.length,
      loading: null,
      failed: false,
      loadMore: () => setShown({ key, count: drawn + PAGE_SIZE }),
      reload: () => {},
      refreshCount: () => {},
      addNewest: () => {},
      allIds: () => all.map((link) => link.id),
      has: () => true,
    };
  }

  const byId = new Map(links.map((link) => [link.id, link]));
  const current = list && query ? list : null;
  const listed = current
    ? current.ids
        .map((id) => byId.get(id))
        .filter((link): link is Link => link !== undefined && matchesQuery(link, current.query))
    : [];
  const loading = !query || !list || list.want === want ? null : visit.keep && searchless(list.query) === searchless(query) ? "update" : "new";

  return {
    links: loading === "new" ? [] : listed,
    total: loading === "new" ? 0 : (current?.total ?? 0),
    hasMore: loading === null && Boolean(current?.next),
    loading,
    failed: loading === null && Boolean(current?.failed),
    loadMore() {
      const from = list;
      if (!from?.next || loadingMore.current || from.want !== want) return;
      loadingMore.current = true;
      source
        .page(from.query, from.next)
        .then((page) => {
          learn(page.links);
          setList((now) => {
            if (!now || now.want !== from.want) return now;
            const have = new Set(now.ids);
            return { ...now, ids: [...now.ids, ...page.links.map((link) => link.id).filter((id) => !have.has(id))], next: page.next, total: page.total };
          });
        })
        .catch(() => {})
        .finally(() => {
          loadingMore.current = false;
        });
    },
    reload,
    refreshCount() {
      const from = list;
      if (!from || from.failed) return;
      source.count(from.query).then(
        (total) => setList((now) => (now && now.want === from.want ? { ...now, total } : now)),
        () => {}
      );
    },
    addNewest(link) {
      if (list?.query.sort !== "newest") {
        reload();
        return;
      }
      if (!matchesQuery(link, list.query)) return;
      setList((now) => (now ? { ...now, ids: [link.id, ...now.ids.filter((id) => id !== link.id)], total: now.total + 1 } : now));
    },
    has: (id) => Boolean(current?.ids.includes(id)),
    allIds() {
      if (!current) return [];
      if (!current.next) return listed.map((link) => link.id);
      return source.all(current.query).then((every) => {
        learn(every);
        return every.map((link) => link.id);
      });
    },
  };
}
