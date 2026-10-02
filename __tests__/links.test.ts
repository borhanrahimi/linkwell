import { describe, expect, test } from "vitest";
import { createLink, formatDate } from "@/lib/links";

describe("createLink", () => {
  test("keeps the url it was given", () => {
    const link = createLink("https://example.com");

    expect(link.url).toBe("https://example.com");
  });

  test("gives every link a different id", () => {
    const first = createLink("https://example.com");
    const second = createLink("https://example.com");

    expect(first.id).not.toBe(second.id);
  });

  test("stores createdAt as an ISO date string", () => {
    const link = createLink("https://example.com");

    expect(new Date(link.createdAt).toISOString()).toBe(link.createdAt);
  });
});

describe("formatDate", () => {
  test("turns an ISO string into a readable date", () => {
    const iso = "2026-10-02T14:30:00.000Z";

    expect(formatDate(iso)).toBe(new Date(iso).toLocaleString());
  });
});
