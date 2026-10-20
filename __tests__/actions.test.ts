import { afterEach, describe, expect, test, vi } from "vitest";
import { checkAllLinks, createFolder, deleteFolder, renameFolder, setFolderColor, importBookmarks, importLinks, moveToFolder, removeLink, saveLink, saveLinkDetails, saveReadStatus, saveUsername } from "@/app/actions";
import { deleteFolderById, deleteLinkById, getFolders, getLinks, insertFolder, insertLink, insertLinks, isUsernameTaken, updateFolderColor, updateFolderName, updateLinkFolder, updateLinkReadAt, updateLinkDetails, updateLinkStatus, updateUsername } from "@/lib/data";
import { checkLink } from "@/lib/checkLink";
import { fetchTitle } from "@/lib/fetchTitle";
import { getUserId } from "@/lib/session";

vi.mock("@/lib/data", () => ({
  getLinks: vi.fn(async () => []),
  insertLink: vi.fn(async () => {}),
  insertLinks: vi.fn(async () => {}),
  deleteLinkById: vi.fn(async () => {}),
  updateLinkDetails: vi.fn(async () => {}),
  updateLinkStatus: vi.fn(async () => {}),
  updateLinkReadAt: vi.fn(async () => {}),
  updateLinkFolder: vi.fn(async () => {}),
  updateFolderName: vi.fn(async () => {}),
  updateFolderColor: vi.fn(async () => {}),
  deleteFolderById: vi.fn(async () => {}),
  getFolders: vi.fn(async () => []),
  insertFolder: vi.fn(async (_userId: string, name: string) => ({ id: "f1", name })),
  isUsernameTaken: vi.fn(async () => false),
  updateUsername: vi.fn(async () => {}),
}));

vi.mock("@/lib/session", () => ({
  getUserId: vi.fn(async () => "u1"),
}));

vi.mock("@/lib/checkLink", () => ({
  checkLink: vi.fn(async () => "ok"),
}));

vi.mock("@/lib/fetchTitle", () => ({
  fetchTitle: vi.fn(async () => undefined),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserId).mockResolvedValue("u1");
});

const link = { id: "1", url: "https://example.com", tags: [], createdAt: "2026-10-01T12:00:00.000Z" };

describe("signed out", () => {
  test("every action refuses to run and touches no data", async () => {
    vi.mocked(getUserId).mockRejectedValue(new Error("Not signed in"));

    await expect(saveLink(link)).rejects.toThrow("Not signed in");
    await expect(removeLink("1")).rejects.toThrow("Not signed in");
    await expect(saveLinkDetails("1", { title: "", tags: "", note: "" })).rejects.toThrow("Not signed in");
    await expect(saveReadStatus("1", true)).rejects.toThrow("Not signed in");
    await expect(moveToFolder("1", null)).rejects.toThrow("Not signed in");
    await expect(importLinks([link])).rejects.toThrow("Not signed in");
    await expect(importBookmarks([])).rejects.toThrow("Not signed in");
    await expect(checkAllLinks()).rejects.toThrow("Not signed in");
    await expect(createFolder("Work")).rejects.toThrow("Not signed in");
    await expect(renameFolder("f1", "Job")).rejects.toThrow("Not signed in");
    await expect(deleteFolder("f1")).rejects.toThrow("Not signed in");
    await expect(setFolderColor("f1", "green")).rejects.toThrow("Not signed in");
    await expect(saveUsername("ada")).rejects.toThrow("Not signed in");

    expect(getLinks).not.toHaveBeenCalled();
    expect(getFolders).not.toHaveBeenCalled();
    expect(insertLink).not.toHaveBeenCalled();
    expect(insertLinks).not.toHaveBeenCalled();
    expect(deleteLinkById).not.toHaveBeenCalled();
    expect(insertFolder).not.toHaveBeenCalled();
    expect(deleteFolderById).not.toHaveBeenCalled();
    expect(updateUsername).not.toHaveBeenCalled();
    expect(updateLinkDetails).not.toHaveBeenCalled();
  });
});

describe("saveLink", () => {
  test("saves a new link", async () => {
    expect(await saveLink(link)).toEqual(link);
    expect(insertLink).toHaveBeenCalledWith("u1", link);
  });

  test("only looks for duplicates among the user's own links", async () => {
    await saveLink(link);

    expect(getLinks).toHaveBeenCalledWith("u1");
  });

  test("fills in the page's title when none was given", async () => {
    vi.mocked(fetchTitle).mockResolvedValueOnce("Example Domain");

    expect(await saveLink(link)).toEqual({ ...link, title: "Example Domain" });
    expect(insertLink).toHaveBeenCalledWith("u1", { ...link, title: "Example Domain" });
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

    expect(deleteLinkById).toHaveBeenCalledWith("u1", "1");
  });
});

describe("saveLinkDetails", () => {
  test("cleans the details on the server, saves and returns them", async () => {
    const saved = await saveLinkDetails("1", { title: " React ", tags: "React, docs", note: " For Monday " });

    const cleaned = { title: "React", tags: ["react", "docs"], note: "For Monday" };
    expect(updateLinkDetails).toHaveBeenCalledWith("u1", "1", cleaned);
    expect(saved).toEqual(cleaned);
  });
});

describe("importLinks", () => {
  const old = { id: "old-1", url: "https://old.com", createdAt: "2026-01-01T00:00:00.000Z" };

  test("saves old links with a new id and returns them", async () => {
    const imported = await importLinks([old]);

    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({ url: "https://old.com", createdAt: old.createdAt });
    expect(imported[0].id).not.toBe("old-1");
    expect(insertLink).toHaveBeenCalledWith("u1", imported[0]);
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

    expect(updateLinkStatus).toHaveBeenCalledWith("u1", "1", "ok");
    expect(updateLinkStatus).toHaveBeenCalledWith("u1", "2", "broken");
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

    expect(updateLinkReadAt).toHaveBeenCalledWith("u1", "1", expect.any(Date));
  });

  test("clears the time when a link is marked as unread", async () => {
    await saveReadStatus("1", false);

    expect(updateLinkReadAt).toHaveBeenCalledWith("u1", "1", null);
  });
});

describe("createFolder", () => {
  test("creates a folder with a trimmed name", async () => {
    expect(await createFolder("  Work  ")).toEqual({ id: "f1", name: "Work" });
    // The first folder gets the first palette colour.
    expect(insertFolder).toHaveBeenCalledWith("u1", "Work", "blue");
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
    vi.mocked(getFolders).mockResolvedValueOnce([{ id: "f1", name: "Work" }]);

    await moveToFolder("1", "f1");

    expect(updateLinkFolder).toHaveBeenCalledWith("u1", "1", "f1");
  });

  test("takes the link out of any folder", async () => {
    await moveToFolder("1", null);

    expect(updateLinkFolder).toHaveBeenCalledWith("u1", "1", null);
  });

  test("refuses a folder that isn't the user's own", async () => {
    vi.mocked(getFolders).mockResolvedValueOnce([{ id: "f1", name: "Work" }]);

    await moveToFolder("1", "someone-elses-folder");

    expect(getFolders).toHaveBeenCalledWith("u1");
    expect(updateLinkFolder).not.toHaveBeenCalled();
  });
});

describe("renameFolder", () => {
  test("renames the folder with a trimmed name", async () => {
    expect(await renameFolder("f1", "  Job  ")).toBeNull();
    expect(updateFolderName).toHaveBeenCalledWith("u1", "f1", "Job");
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

    expect(deleteFolderById).toHaveBeenCalledWith("u1", "f1");
  });
});

describe("saveUsername", () => {
  test("saves the username in lowercase, without the @", async () => {
    expect(await saveUsername("  @Ada_L ")).toBeNull();
    expect(isUsernameTaken).toHaveBeenCalledWith("u1", "ada_l");
    expect(updateUsername).toHaveBeenCalledWith("u1", "ada_l");
  });

  test("refuses a username that breaks the rules", async () => {
    expect(await saveUsername("a!")).toBe("Usernames need at least 3 characters.");
    expect(updateUsername).not.toHaveBeenCalled();
  });

  test("refuses a username someone else has", async () => {
    vi.mocked(isUsernameTaken).mockResolvedValueOnce(true);

    expect(await saveUsername("ada")).toBe("@ada is already taken.");
    expect(updateUsername).not.toHaveBeenCalled();
  });
});

describe("importBookmarks", () => {
  const soup = { url: "https://example.com/soup", title: "Soup", tags: ["food"], folder: "Recipes", addDate: "2020-01-01T00:00:00.000Z" };

  test("saves the links with their title, tags and date", async () => {
    const result = await importBookmarks([{ ...soup, folder: undefined }]);

    expect(result).toEqual({ added: 1, skipped: 0 });
    expect(insertLinks).toHaveBeenCalledWith("u1", [
      expect.objectContaining({ url: "https://example.com/soup", title: "Soup", tags: ["food"], createdAt: "2020-01-01T00:00:00.000Z", folderId: undefined }),
    ]);
  });

  test("makes a missing folder once, and reuses folders you have (ignoring case)", async () => {
    vi.mocked(getFolders).mockResolvedValueOnce([{ id: "w1", name: "Work" }]);

    await importBookmarks([
      soup,
      { ...soup, url: "https://example.com/bread" },
      { ...soup, url: "https://example.com/job", folder: "work" },
    ]);

    expect(insertFolder).toHaveBeenCalledTimes(1);
    // The user already has one folder (Work), so Recipes gets the second colour.
    expect(insertFolder).toHaveBeenCalledWith("u1", "Recipes", "green");
    const saved = vi.mocked(insertLinks).mock.calls[0][1];
    expect(saved.map((l) => l.folderId)).toEqual(["f1", "f1", "w1"]);
  });

  test("skips links you already have, and repeats in the file", async () => {
    vi.mocked(getLinks).mockResolvedValueOnce([{ ...link, url: "https://example.com/soup" }]);

    const result = await importBookmarks([soup, { ...soup, url: "https://example.com/a" }, { ...soup, url: "https://example.com/a" }]);

    expect(result).toEqual({ added: 1, skipped: 2 });
  });

  test("skips bookmarks that aren't web addresses", async () => {
    const result = await importBookmarks([{ ...soup, url: "javascript:alert(1)" }]);

    expect(result).toEqual({ added: 0, skipped: 1 });
    expect(insertFolder).not.toHaveBeenCalled();
  });

  test("refuses batches that are too big", async () => {
    const tooMany = Array.from({ length: 201 }, (_, i) => ({ ...soup, url: `https://example.com/${i}` }));

    await expect(importBookmarks(tooMany)).rejects.toThrow("Too many bookmarks");
    expect(insertLinks).not.toHaveBeenCalled();
  });
});

describe("setFolderColor", () => {
  test("saves a colour from the palette", async () => {
    await setFolderColor("f1", "green");

    expect(updateFolderColor).toHaveBeenCalledWith("u1", "f1", "green");
  });

  test("refuses anything else", async () => {
    await setFolderColor("f1", "rainbow; background:url(x)" as never);

    expect(updateFolderColor).not.toHaveBeenCalled();
  });
});
