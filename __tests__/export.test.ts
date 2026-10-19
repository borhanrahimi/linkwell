import { afterEach, describe, expect, test, vi } from "vitest";
import { GET } from "@/app/api/export/route";
import { auth } from "@/lib/auth";
import { getFolders, getLinks } from "@/lib/data";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn(async () => ({ user: { id: "u1" } })) } },
}));

vi.mock("@/lib/data", () => ({
  getLinks: vi.fn(async () => [{ id: "1", url: "https://example.com", title: "Example", createdAt: "2020-01-01T00:00:00.000Z" }]),
  getFolders: vi.fn(async () => []),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/export", () => {
  test("refuses visitors who aren't signed in", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(getLinks).not.toHaveBeenCalled();
  });

  test("sends the user's own links as a bookmarks file download", async () => {
    const response = await GET();

    expect(getLinks).toHaveBeenCalledWith("u1");
    expect(getFolders).toHaveBeenCalledWith("u1");
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toMatch(/^attachment; filename="linkwell-bookmarks-\d{4}-\d{2}-\d{2}\.html"$/);
    expect(await response.text()).toContain('<A HREF="https://example.com"');
  });

  test("tells browsers not to keep a copy", async () => {
    expect((await GET()).headers.get("Cache-Control")).toBe("no-store");
  });
});
