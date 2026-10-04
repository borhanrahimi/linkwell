import { afterEach, describe, expect, test } from "vitest";
import {
  STORAGE_KEY,
  createLink,
  formatDate,
  getDomain,
  loadLinks,
  saveLinks,
} from "@/lib/links";

afterEach(() => {
  localStorage.clear();
});

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

describe("loadLinks and saveLinks", () => {
  test("returns an empty list when nothing is saved", () => {
    expect(loadLinks()).toEqual([]);
  });

  test("loads links that were saved", () => {
    const links = [
      createLink("https://example.com"),
      createLink("https.nextjs.org"),
    ];

    saveLinks(links);
    expect(loadLinks()).toEqual(links);
  });
  test("returns an empty list when the saved data is invalid", () => {
    localStorage.setItem(STORAGE_KEY, "invalid json");

    expect(loadLinks()).toEqual([]);
  });
});

describe("getDomain", () => {
  test("returns the domain of a URL", () => {
    expect(getDomain("https://nextjs.org/docs/app")).toBe("nextjs.org");
  });

  test("drop a leading www", () => {
    expect(getDomain("https://www.example.com/path")).toBe("example.com");
  });

  test("returns the text unchanged if the URL is invalid", () => {
    expect(getDomain("not a url")).toBe("not a url");
  });
});
