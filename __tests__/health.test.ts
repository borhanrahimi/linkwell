import { afterEach, describe, expect, test, vi } from "vitest";
import { GET } from "@/app/api/health/route";
import { isDatabaseUp } from "@/lib/data";

vi.mock("@/lib/data", () => ({ isDatabaseUp: vi.fn(async () => true) }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/health", () => {
  test("answers 200 ok when the app reaches the database", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("answers 503 when the database can't be reached, so the monitor emails you", async () => {
    vi.mocked(isDatabaseUp).mockResolvedValueOnce(false);

    const response = await GET();

    expect(response.status).toBe(503);
    // Nothing more than "down": anyone can open this address.
    expect(await response.json()).toEqual({ status: "down" });
  });
});
