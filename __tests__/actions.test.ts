import { afterEach, describe, expect, test, vi } from "vitest";
import { removeLink, saveLink, saveTitle } from "@/app/actions";
import { deleteLinkById, getLinks, insertLink, updateLinkTitle } from "@/lib/data";

vi.mock("@/lib/data", () => ({
  getLinks: vi.fn(async () => []),
  insertLink: vi.fn(async () => {}),
  deleteLinkById: vi.fn(async () => {}),
  updateLinkTitle: vi.fn(async () => {}),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const link = { id: "1", url: "https://example.com", tags: [], createdAt: "2026-10-01T12:00:00.000Z" };

describe("saveLink", () => {
  test("saves a new link", async () => {
    expect(await saveLink(link)).toBeNull();
    expect(insertLink).toHaveBeenCalledWith(link);
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
