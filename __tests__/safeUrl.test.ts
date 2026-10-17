import { describe, expect, test, vi } from "vitest";
import {
  assertPublicUrl,
  BlockedUrlError,
  isPrivateAddress,
  safeFetch,
  type LookupFn,
} from "../lib/safeUrl";

describe("isPrivateAddress", () => {
  test("allows normal public addresses", () => {
    expect(isPrivateAddress("93.184.215.14")).toBe(false);
    expect(isPrivateAddress("2606:4700::1111")).toBe(false);
  });

  test("blocks localhost", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("::1")).toBe(true);
  });

  test("blocks home and office networks", () => {
    expect(isPrivateAddress("10.0.0.5")).toBe(true);
    expect(isPrivateAddress("172.16.0.1")).toBe(true);
    expect(isPrivateAddress("192.168.1.1")).toBe(true);
    expect(isPrivateAddress("fd00::1")).toBe(true);
  });

  test("blocks the cloud metadata address", () => {
    expect(isPrivateAddress("169.254.169.254")).toBe(true);
  });

  test("blocks IPv4 addresses hidden inside IPv6", () => {
    expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateAddress("::ffff:93.184.215.14")).toBe(false);
  });

  test("blocks anything that is not an IP address", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
    expect(isPrivateAddress("")).toBe(true);
  });
});

function resolvesTo(...addresses: string[]): LookupFn {
  return async () => addresses.map((address) => ({ address }));
}

describe("assertPublicUrl", () => {
  test("allows a site on a public address", async () => {
    await expect(
      assertPublicUrl("https://example.com", resolvesTo("93.184.215.14"))
    ).resolves.toBeUndefined();
  });

  test("blocks a site whose name points to a private address", async () => {
    await expect(
      assertPublicUrl("http://sneaky.example", resolvesTo("127.0.0.1"))
    ).rejects.toThrow(BlockedUrlError);
  });

  test("blocks a site if any of its addresses is private", async () => {
    await expect(
      assertPublicUrl(
        "http://sneaky.example",
        resolvesTo("93.184.215.14", "10.0.0.1")
      )
    ).rejects.toThrow(BlockedUrlError);
  });

  test("blocks private IP addresses typed straight into the URL", async () => {
    const lookupFn = vi.fn(resolvesTo("93.184.215.14"));
    await expect(
      assertPublicUrl("http://169.254.169.254/latest/meta-data", lookupFn)
    ).rejects.toThrow(BlockedUrlError);
    await expect(
      assertPublicUrl("http://[::1]:3000", lookupFn)
    ).rejects.toThrow(BlockedUrlError);
    expect(lookupFn).not.toHaveBeenCalled();
  });

  test("blocks anything that is not http or https", async () => {
    await expect(
      assertPublicUrl("file:///etc/passwd", resolvesTo("93.184.215.14"))
    ).rejects.toThrow(BlockedUrlError);
  });

  test("blocks text that is not a URL", async () => {
    await expect(
      assertPublicUrl("not a url", resolvesTo("93.184.215.14"))
    ).rejects.toThrow(BlockedUrlError);
  });
});
// Names starting with "internal" point inside the network; everything else is public.
const fakeDns: LookupFn = async (hostname) => [
  { address: hostname.startsWith("internal") ? "10.0.0.1" : "93.184.215.14" },
];

// Each URL either redirects (a string: where to go next) or answers with a status code.
function site(pages: Record<string, string | number>) {
  return vi.fn(async (input: string | URL | Request) => {
    const page = pages[String(input)] ?? 404;
    if (typeof page === "string") {
      return new Response(null, { status: 302, headers: { location: page } });
    }
    return new Response("hello", { status: page });
  });
}

describe("safeFetch", () => {
  test("fetches a public page", async () => {
    const fetchFn = site({ "https://example.com/": 200 });
    const response = await safeFetch(
      "https://example.com/",
      {},
      fetchFn,
      fakeDns
    );
    expect(response.status).toBe(200);
  });

  test("follows redirects between public pages, also relative ones", async () => {
    const fetchFn = site({
      "http://example.com/": "https://example.com/",
      "https://example.com/": "/home",
      "https://example.com/home": 200,
    });
    const response = await safeFetch(
      "http://example.com/",
      {},
      fetchFn,
      fakeDns
    );
    expect(response.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  test("never follows a redirect to a private address", async () => {
    const fetchFn = site({ "https://example.com/": "http://127.0.0.1/admin" });
    await expect(
      safeFetch("https://example.com/", {}, fetchFn, fakeDns)
    ).rejects.toThrow(BlockedUrlError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("never follows a redirect to a name that points inside the network", async () => {
    const fetchFn = site({
      "https://example.com/": "http://internal.example/",
    });
    await expect(
      safeFetch("https://example.com/", {}, fetchFn, fakeDns)
    ).rejects.toThrow(BlockedUrlError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("gives up after too many redirects", async () => {
    const fetchFn = site({
      "https://a.example/": "https://b.example/",
      "https://b.example/": "https://a.example/",
    });
    await expect(
      safeFetch("https://a.example/", {}, fetchFn, fakeDns)
    ).rejects.toThrow(BlockedUrlError);
    expect(fetchFn).toHaveBeenCalledTimes(6);
  });

  test("passes options through but always handles redirects itself", async () => {
    const fetchFn = site({ "https://example.com/": 200 });
    const signal = AbortSignal.timeout(1_000);
    await safeFetch("https://example.com/", { signal }, fetchFn, fakeDns);
    expect(fetchFn).toHaveBeenCalledWith("https://example.com/", {
      signal,
      redirect: "manual",
    });
  });
});
