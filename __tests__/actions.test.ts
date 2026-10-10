import { afterEach, describe, expect, test, vi } from "vitest";
import { checkAllLinks, createFolder, deleteFolder, renameFolder, importLinks, moveToFolder, removeLink, saveLink, saveReadStatus, saveTitle } from "@/app/actions";
import { deleteFolderById, deleteLinkById, getFolders, getLinks, insertFolder, insertLink, updateFolderName, updateLinkFolder, updateLinkReadAt, updateLinkStatus, updateLinkTitle } from "@/lib/data";
import { checkLink } from "@/lib/checkLink";
import { fetchTitle } from "@/lib/fetchTitle";

vi.mock("@/lib/data", () => ({
  getLinks: vi.fn(async () => []),
  insertLink: vi.fn(async () => {}),
  deleteLinkById: vi.fn(async () => {}),
  updateLinkTitle: vi.fn(async () => {}),
  updateLinkStatus: vi.fn(async () => {}),
  updateLinkReadAt: vi.fn(async () => {}),
  updateLinkFolder: vi.fn(async () => {}),
  updateFolderName: vi.fn(async () => {}),
  deleteFolderById: vi.fn(async () => {}),
  getFolders: vi.fn(async () => []),
  insertFolder: vi.fn(async (name: string) => ({ id: "f1", name })),
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

describe("saveReadStatus", () => {
  test("saves the time when a link is marked as read", async () => {
    await saveReadStatus("1", true);

    expect(updateLinkReadAt).toHaveBeenCalledWith("1", expect.any(Date));
  });

  test("clears the time when a link is marked as unread", async () => {
    await saveReadStatus("1", false);

    expect(updateLinkReadAt).toHaveBeenCalledWith("1", null);
  });
});

describe("createFolder", () => {
  test("creates a folder with a trimmed name", async () => {
    expect(await createFolder("  Work  ")).toEqual({ id: "f1", name: "Work" });
    expect(insertFolder).toHaveBeenCalledWith("Work");
  });

  test("refuses an empty name", async () => {
    expect(await createFolder("   ")).toBe("Please give the folder a name.");
    expect(insertFolder).not.toHaveBeenCalled();
  });

  test("refuses a name that already exists, ignoring case", async () => {
    vi.mocked(getFolders).mockResolvedValueOnce([{ id: "f1", name: "Work" }]);

    expect(await createFolder("work")).toBe('You already have a folder called "work".');
    expect(insertFolder).not.toHaveBeenCalled();
  });
});

describe("moveToFolder", () => {
  test("puts the link into the folder", async () => {
    await moveToFolder("1", "f1");

    expect(updateLinkFolder).toHaveBeenCalledWith("1", "f1");
  });

  test("takes the link out of any folder", async () => {
    await moveToFolder("1", null);

    expect(updateLinkFolder).toHaveBeenCalledWith("1", null);
  });
});

describe("renameFolder", () => {
  test("renames the folder with a trimmed name", async () => {
    expect(await renameFolder("f1", "  Job  ")).toBeNull();
    expect(updateFolderName).toHaveBeenCalledWith("f1", "Job");
  });

  test("refuses an empty name", async () => {
    expect(await renameFolder("f1", " ")).toBe("Please give the folder a name.");
    expect(updateFolderName).not.toHaveBeenCalled();
  });

  test("refuses the name of another folder", async () => {
    vi.mocked(getFolders).mockResolvedValueOnce([
      { id: "f1", name: "Work" },
      { id: "f2", name: "Recipes" },
    ]);

    expect(await renameFolder("f1", "recipes")).toBe('You already have a folder called "recipes".');
  });

  test("allows changing only the capitals of its own name", async () => {
    vi.mocked(getFolders).mockResolvedValueOnce([{ id: "f1", name: "work" }]);

    expect(await renameFolder("f1", "Work")).toBeNull();
  });
});

describe("deleteFolder", () => {
  test("deletes the folder", async () => {
    await deleteFolder("f1");

    expect(deleteFolderById).toHaveBeenCalledWith("f1");
  });
});
