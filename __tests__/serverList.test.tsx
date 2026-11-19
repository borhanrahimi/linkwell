import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import LinkManager from "@/components/LinkManager";
import { removeLink } from "@/app/actions";
import { PAGE_SIZE, queryKey, queryLinks, summarize, type LinkQuery } from "@/lib/linkQuery";
import type { LinkSource } from "@/lib/linkSource";
import type { Link } from "@/types/link";

// Signed in (v2.5), the page doesn't get every link: a summary, and lists a
// page at a time from a LinkSource. Here the source is a fake over 120 links.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

// Every action does nothing; the tests look at what was asked.
vi.mock("@/app/actions", () => {
  const names = ["checkAllLinks", "createFolder", "deleteFolder", "deleteForever", "emptyTrash", "importLinks", "markLinksRead", "moveFolder", "moveLinksToFolder", "moveToFolder", "removeLink", "removeLinks", "renameFolder", "restoreFolder", "restoreLinks", "saveLink", "saveLinkDetails", "saveReadStatus", "setFolderColor", "setFolderIcon", "setFolderPinned", "setReadDates"];
  return Object.fromEntries(names.map((name) => [name, vi.fn(async () => {})]));
});

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-18T12:00:00.000Z");
const every: Link[] = Array.from({ length: 120 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  url: `https://example.com/${i}`,
  title: i % 40 === 0 ? `Lentil soup ${i}` : `Link ${i}`,
  tags: [],
  createdAt: new Date(now.getTime() - i * DAY).toISOString(),
}));
const allQuery: LinkQuery = { list: "all", folderIds: null, tag: null, search: "", sort: "newest" };

// Pages of PAGE_SIZE; the cursor is just where the next page starts.
function fakeSource(): LinkSource & { [K in keyof LinkSource]: ReturnType<typeof vi.fn> } {
  const page = (query: LinkQuery, after: string | null) => {
    const found = queryLinks(every, query);
    const start = after ? Number(after) : 0;
    const end = start + PAGE_SIZE;
    return { links: found.slice(start, end), total: found.length, next: end < found.length ? String(end) : null };
  };
  return {
    page: vi.fn(async (query: LinkQuery, after: string | null) => page(query, after)),
    all: vi.fn(async (query: LinkQuery) => queryLinks(every, query)),
    count: vi.fn(async (query: LinkQuery) => queryLinks(every, query).length),
    summary: vi.fn(async () => summarize(every, now)),
  };
}

function renderSignedIn(source = fakeSource()) {
  const first = { links: every.slice(0, PAGE_SIZE), total: every.length, next: String(PAGE_SIZE) };
  render(
    <LinkManager
      initialLinks={first.links}
      initialSummary={summarize(every, now)}
      initialPage={{ key: queryKey(allQuery), page: first }}
      source={source}
      now={now}
    />
  );
  return source;
}

function cardCount() {
  return screen.getByRole("list", { name: "Links" }).children.length;
}

beforeEach(() => {
  window.history.replaceState(null, "", "/?list=all");
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
});

test("draws only the first page, but counts the whole list", () => {
  const source = renderSignedIn();

  expect(cardCount()).toBe(PAGE_SIZE);
  expect(screen.getByText("120 links")).toBeDefined();
  // The sidebar's counts come from the summary, not from the links on the page.
  expect(within(screen.getByRole("button", { name: /All links/ })).getByText("120")).toBeDefined();
  // The first page came with the page itself.
  expect(source.page).not.toHaveBeenCalled();
});

test("the next page comes after the last one, and the end has no Show more", async () => {
  const source = renderSignedIn();

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Show more links" })));
  expect(source.page).toHaveBeenCalledWith(expect.objectContaining({ list: "all" }), String(PAGE_SIZE));
  expect(cardCount()).toBe(PAGE_SIZE * 2);

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Show more links" })));
  expect(cardCount()).toBe(120);
  expect(screen.queryByRole("button", { name: "Show more links" })).toBeNull();
});

test("Select all picks every link of the list, not just the ones drawn", async () => {
  const source = renderSignedIn();

  fireEvent.click(screen.getByRole("button", { name: "Select" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Select all 120" })));

  expect(source.all).toHaveBeenCalledTimes(1);
  expect(screen.getByText("120 selected")).toBeDefined();
});

test("bulk actions on a long selection go in batches the server accepts", async () => {
  const { markLinksRead } = await import("@/app/actions");
  const source = fakeSource();
  // 600 links: more than one batch of 500.
  const many = Array.from({ length: 600 }, (_, i) => ({ ...every[0], id: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}` }));
  source.all.mockResolvedValueOnce(many);
  renderSignedIn(source);

  fireEvent.click(screen.getByRole("button", { name: "Select" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Select all 120" })));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Mark read" })));

  expect(vi.mocked(markLinksRead).mock.calls.map(([ids]) => ids.length)).toEqual([500, 100]);
});

test("search asks the server once typing stops, and shows its answer", async () => {
  vi.useFakeTimers();
  const source = renderSignedIn();

  const box = screen.getByRole("searchbox", { name: "Search links" });
  for (const text of ["l", "le", "len", "lentil"]) fireEvent.change(box, { target: { value: text } });
  expect(source.page).not.toHaveBeenCalled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(source.page).toHaveBeenCalledTimes(1);
  expect(source.page).toHaveBeenCalledWith(expect.objectContaining({ search: "lentil" }), null, expect.any(AbortSignal));
  expect(screen.getByText("3 links")).toBeDefined();
  expect(cardCount()).toBe(3);
});

test("an answer to an older search is dropped", async () => {
  vi.useFakeTimers();
  const source = fakeSource();
  const signals: AbortSignal[] = [];
  source.page.mockImplementation((_query: LinkQuery, _after: string | null, signal: AbortSignal) => {
    signals.push(signal);
    return new Promise(() => {});
  });
  renderSignedIn(source);

  const box = screen.getByRole("searchbox", { name: "Search links" });
  fireEvent.change(box, { target: { value: "lentil" } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  fireEvent.change(box, { target: { value: "soup" } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(signals).toHaveLength(2);
  expect(signals[0].aborted).toBe(true);
  expect(signals[1].aborted).toBe(false);
});

test("after a change, the counts are asked for again", async () => {
  vi.useFakeTimers();
  const source = renderSignedIn();

  const firstCard = within(screen.getByRole("list", { name: "Links" }).children[0] as HTMLElement);
  await act(async () => fireEvent.click(firstCard.getByRole("button", { name: /Delete/ })));
  expect(removeLink).toHaveBeenCalledWith(every[0].id);
  // The card goes at once...
  expect(cardCount()).toBe(PAGE_SIZE - 1);

  // ...and the numbers follow once things settle.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
  expect(source.summary).toHaveBeenCalledTimes(1);
  expect(source.count).toHaveBeenCalledTimes(1);
  // The fake server's summary still has the deleted link (as a real answer
  // sent before the delete arrived would): it doesn't come back.
  expect(cardCount()).toBe(PAGE_SIZE - 1);
});

test("coming back to a list asks for it again (changes made elsewhere show)", async () => {
  const source = renderSignedIn();

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Trash" })));
  expect(screen.queryByRole("list", { name: "Links" })).toBeNull();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /^All links/ })));

  expect(source.page).toHaveBeenCalledWith(expect.objectContaining({ list: "all" }), null, expect.any(AbortSignal));
  expect(cardCount()).toBe(PAGE_SIZE);
});
