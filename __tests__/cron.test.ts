import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "@/app/api/cron/check-links/route";
import { getLinksToCheck, getLinksWithoutImage, updateLinkImage, updateLinkStatus } from "@/lib/data";
import { fetchPageInfo } from "@/lib/fetchTitle";
import { checkLink } from "@/lib/checkLink";

vi.mock("@/lib/data", () => ({
  getLinksToCheck: vi.fn(async () => []),
  updateLinkStatus: vi.fn(async () => {}),
  deleteOldRateLimits: vi.fn(async () => {}),
  getLinksWithoutImage: vi.fn(async () => []),
  updateLinkImage: vi.fn(async () => {}),
}));

vi.mock("@/lib/fetchTitle", () => ({
  fetchPageInfo: vi.fn(async () => ({})),
}));

vi.mock("@/lib/checkLink", () => ({
  checkLink: vi.fn(async () => "ok"),
}));

function callWith(authorization?: string) {
  const headers = authorization ? { authorization } : undefined;
  return GET(new Request("http://localhost/api/cron/check-links", { headers }));
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "s3cret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("GET /api/cron/check-links", () => {
  test("refuses a request without the secret", async () => {
    expect((await callWith()).status).toBe(401);
    expect(getLinksToCheck).not.toHaveBeenCalled();
  });

  test("refuses a wrong secret", async () => {
    expect((await callWith("Bearer wrong")).status).toBe(401);
    expect(getLinksToCheck).not.toHaveBeenCalled();
  });

  test("refuses everything when CRON_SECRET isn't set", async () => {
    vi.stubEnv("CRON_SECRET", "");

    expect((await callWith("Bearer ")).status).toBe(401);
    expect(getLinksToCheck).not.toHaveBeenCalled();
  });

  test("checks every user's links and saves each result for its owner", async () => {
    vi.mocked(getLinksToCheck).mockResolvedValueOnce([
      { id: "1", userId: "u1", url: "https://example.com" },
      { id: "2", userId: "u2", url: "https://dead.example" },
    ]);
    vi.mocked(checkLink).mockImplementation(async (url) => (url === "https://dead.example" ? "broken" : "ok"));

    const response = await callWith("Bearer s3cret");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ checked: 2, broken: 1, imagesLookedFor: 0 });
    expect(updateLinkStatus).toHaveBeenCalledWith("u1", "1", "ok");
    expect(updateLinkStatus).toHaveBeenCalledWith("u2", "2", "broken");
  });

  test("looks for preview pictures of older links, a batch a day, and remembers when there's none", async () => {
    vi.mocked(getLinksWithoutImage).mockResolvedValueOnce([
      { id: "1", userId: "u1", url: "https://pictured.example" },
      { id: "2", userId: "u2", url: "https://plain.example" },
    ]);
    vi.mocked(fetchPageInfo).mockImplementation(async (url) =>
      url === "https://pictured.example" ? { image: "https://pictured.example/card.png" } : {}
    );

    const response = await callWith("Bearer s3cret");

    expect(getLinksWithoutImage).toHaveBeenCalledWith(50);
    expect(updateLinkImage).toHaveBeenCalledWith("u1", "1", "https://pictured.example/card.png");
    expect(updateLinkImage).toHaveBeenCalledWith("u2", "2", "");
    expect(await response.json()).toMatchObject({ imagesLookedFor: 2 });
  });
});
