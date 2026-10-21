import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "@/app/api/cron/check-links/route";
import { getLinksToCheck, updateLinkStatus } from "@/lib/data";
import { checkLink } from "@/lib/checkLink";

vi.mock("@/lib/data", () => ({
  getLinksToCheck: vi.fn(async () => []),
  updateLinkStatus: vi.fn(async () => {}),
  deleteOldRateLimits: vi.fn(async () => {}),
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
    expect(await response.json()).toEqual({ checked: 2, broken: 1 });
    expect(updateLinkStatus).toHaveBeenCalledWith("u1", "1", "ok");
    expect(updateLinkStatus).toHaveBeenCalledWith("u2", "2", "broken");
  });
});
