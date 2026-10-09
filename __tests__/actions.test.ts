import { afterEach, describe, expect, test, vi } from "vitest";
import { checkAllLinks, importLinks, removeLink, saveLink, saveTitle } from "@/app/actions";
import { deleteLinkById, getLinks, insertLink, updateLinkStatus, updateLinkTitle } from "@/lib/data";
import { checkLink } from "@/lib/checkLink";
import { fetchTitle } from "@/lib/fetchTitle";

vi.mock("@/lib/data", () => ({
  getLinks: vi.fn(async () => []),
  insertLink: vi.fn(async () => {}),
  deleteLinkById: vi.fn(async () => {}),
  updateLinkTitle: vi.fn(async () => {}),
  updateLinkStatus: vi.fn(async () => {}),
}));

vi.mock("@/lib/checkLink", () => ({
  checkLink: vi.fn(async () => "ok"),
}));

vi.mock("@/lib/fetchTitle", () => ({
  fetchTitle: vi.fn(async () => undefined),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const link = { id: "1", url: "https://example.com", tags: [], createdAt: "2026-10-01T12:00:00.000Z" };

describe("saveLink", () => {
  test("saves a new link", async () => {
    expect(await saveLink(link)).toEqual(link);
    expect(insertLink).toHaveBeenCalledWith(link);
  });

  test("fills in the page's title when none was given", async () => {
    vi.mocked(fetchTitle).mockResolvedValueOnce("Example Domain");

    expect(await saveLink(link)).toEqual({ ...link, title: "Example Domain" });
    expect(insertLink).toHaveBeenCalledWith({ ...link, title: "Example Domain" });
  });

  test("keeps the title the user typed", async () => {
    expect(await saveLink({ ...link, title: "My title" })).toMatchObject({ title: "My title" });
    expect(fetchTitle).not.toHaveBeenCalled();
  });

  test("refuses a link that is already saved", async () => {
    vi.mocked(getLinks).mockResolvedValueOnce([link]);

    expect(await saveLink({ ...link, id: "2" })).toBe("You already saved this link!");
    expect(insertLink).not.toHaveBeenCalled();
  });

  test("refuses an empty link", async () => {
    expect(await saveLink({ ...link, url: "   " })).toBe("Please paste a link.");
    expect(insertLink).not.toHaveBeenCalled();
  });
});

describe("removeLink", () => {
  test("deletes the link with that id", async () => {
    await removeLink("1");

    expect(deleteLinkById).toHaveBeenCalledWith("1");
  });
});

describe("saveTitle", () => {
  test("updates the title of the link with that id", async () => {
    await saveTitle("1", "New title");

    expect(updateLinkTitle).toHaveBeenCalledWith("1", "New title");
  });
});

describe("importLinks", () => {
  const old = { id: "old-1", url: "https://old.com", createdAt: "2026-01-01T00:00:00.000Z" };

  test("saves old links with a new id and returns them", async () => {
    const imported = await importLinks([old]);

    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({ url: "https://old.com", createdAt: old.createdAt });
    expect(imported[0].id).not.toBe("old-1");
    expect(insertLink).toHaveBeenCalledWith(imported[0]);
  });

  test("gives links saved before tags existed an empty tag list", async () => {
    const imported = await importLinks([old]);

    expect(imported[0].tags).toEqual([]);
  });

  test("skips links that are already in the database", async () => {
    vi.mocked(getLinks).mockResolvedValueOnce([link]);

    expect(await importLinks([{ ...old, url: "https://example.com" }])).toEqual([]);
    expect(insertLink).not.toHaveBeenCalled();
  });

  test("imports the same url only once", async () => {
    expect(await importLinks([old, { ...old, id: "old-2" }])).toHaveLength(1);
    expect(insertLink).toHaveBeenCalledTimes(1);
  });

  test("skips links with an empty url", async () => {
    expect(await importLinks([{ ...old, url: " " }])).toEqual([]);
  });
});

describe("checkAllLinks", () => {
  const dead = { ...link, id: "2", url: "https://dead.example" };

  test("checks every link and saves each result", async () => {
    vi.mocked(getLinks).mockResolvedValueOnce([link, dead]);
    vi.mocked(checkLink).mockImplementation(async (url) => (url === dead.url ? "broken" : "ok"));

    await checkAllLinks();

    expect(updateLinkStatus).toHaveBeenCalledWith("1", "ok");
    expect(updateLinkStatus).toHaveBeenCalledWith("2", "broken");
  });

  test("returns the links fresh from the database", async () => {
    const checked = [{ ...link, status: "ok" as const }];
    vi.mocked(getLinks).mockResolvedValueOnce([link]).mockResolvedValueOnce(checked);

    expect(await checkAllLinks()).toEqual(checked);
  });
});
