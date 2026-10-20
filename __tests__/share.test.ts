import { describe, expect, test } from "vitest";
import { bookmarkletCode, findSharedUrl, firstValue, shareAddress } from "@/lib/share";

describe("findSharedUrl", () => {
  test("uses the url param", () => {
    expect(findSharedUrl("https://example.com/a", undefined)).toBe("https://example.com/a");
  });

  test("finds a link inside shared text", () => {
    expect(findSharedUrl(undefined, "Look at this https://example.com/post nice")).toBe(
      "https://example.com/post"
    );
  });

  test("prefers url over text", () => {
    expect(findSharedUrl("https://a.com/", "https://b.com/")).toBe("https://a.com/");
  });

  test("takes the first value when a param repeats", () => {
    expect(findSharedUrl(["https://a.com/", "https://b.com/"])).toBe("https://a.com/");
  });

  test("ignores links that are not http or https", () => {
    expect(findSharedUrl("javascript:alert(1)", "ftp://example.com")).toBeNull();
  });

  test("returns null when nothing was shared", () => {
    expect(findSharedUrl(undefined, undefined)).toBeNull();
    expect(findSharedUrl("", "just words")).toBeNull();
  });
});

test("firstValue", () => {
  expect(firstValue(["a", "b"])).toBe("a");
  expect(firstValue("a")).toBe("a");
  expect(firstValue(undefined)).toBeUndefined();
});

test("shareAddress keeps the link and title for after signing in", () => {
  expect(shareAddress("https://example.com/?q=1&x=2", "Hi there")).toBe(
    "/share?url=https%3A%2F%2Fexample.com%2F%3Fq%3D1%26x%3D2&title=Hi+there"
  );
  expect(shareAddress("https://example.com/", "")).toBe("/share?url=https%3A%2F%2Fexample.com%2F");
});

describe("bookmarkletCode", () => {
  // Runs the bookmarklet with a fake page, and returns the address it opened.
  function run(code: string, popupAllowed = true) {
    const opened: string[] = [];
    const location = { href: "https://example.com/post?a=1&b=2" };
    const open = (url: string) => {
      opened.push(url);
      return popupAllowed ? {} : null;
    };
    const body = code.replace(/^javascript:/, "");
    new Function("location", "document", "window", body)(location, { title: "A post & more" }, { open });
    return { opened, location };
  }

  test("opens /share with the page's address and title", () => {
    const { opened } = run(bookmarkletCode("https://linkwell.app"));

    expect(opened).toEqual([
      "https://linkwell.app/share?url=https%3A%2F%2Fexample.com%2Fpost%3Fa%3D1%26b%3D2&title=A%20post%20%26%20more",
    ]);
  });

  test("uses the same tab when new tabs are blocked", () => {
    const { location } = run(bookmarkletCode("https://linkwell.app"), false);

    expect(location.href).toMatch(/^https:\/\/linkwell\.app\/share\?url=/);
  });
});
