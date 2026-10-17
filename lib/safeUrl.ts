import { BlockList, isIP } from "node:net";
import { lookup } from "node:dns/promises";

const privateRanges = new BlockList();
// IPv4
privateRanges.addSubnet("0.0.0.0", 8, "ipv4"); // "this network"
privateRanges.addSubnet("10.0.0.0", 8, "ipv4"); // private
privateRanges.addSubnet("100.64.0.0", 10, "ipv4"); // carrier-grade NAT
privateRanges.addSubnet("127.0.0.0", 8, "ipv4"); // loopback (localhost)
privateRanges.addSubnet("169.254.0.0", 16, "ipv4"); // link-local (cloud metadata)
privateRanges.addSubnet("172.16.0.0", 12, "ipv4"); // private
privateRanges.addSubnet("192.168.0.0", 16, "ipv4"); // private (home routers)
privateRanges.addSubnet("224.0.0.0", 4, "ipv4"); // multicast
privateRanges.addSubnet("240.0.0.0", 4, "ipv4"); // reserved + broadcast
// IPv6
privateRanges.addAddress("::", "ipv6"); // unspecified
privateRanges.addAddress("::1", "ipv6"); // loopback
privateRanges.addSubnet("fc00::", 7, "ipv6"); // unique local (private)
privateRanges.addSubnet("fe80::", 10, "ipv6"); // link-local
privateRanges.addSubnet("ff00::", 8, "ipv6"); // multicast

export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 0) return true; // not an IP address at all: don't trust it

  if (version === 6) {
    // "::ffff:127.0.0.1" is an IPv4 address dressed up as IPv6
    const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return privateRanges.check(ip, "ipv6");
  }

  return privateRanges.check(ip, "ipv4");
}
export class BlockedUrlError extends Error {
  constructor(url: string, reason: string) {
    super(`Blocked ${url}: ${reason}`);
    this.name = "BlockedUrlError";
  }
}

export type LookupFn = (hostname: string) => Promise<{ address: string }[]>;

const lookupAll: LookupFn = (hostname) => lookup(hostname, { all: true });

export async function assertPublicUrl(
  url: string,
  lookupFn: LookupFn = lookupAll
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BlockedUrlError(url, "not a valid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new BlockedUrlError(url, "only http and https are allowed");
  }

  // new URL("http://[::1]/").hostname is "[::1]": remove the brackets
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

  const addresses = isIP(hostname)
    ? [hostname]
    : (await lookupFn(hostname)).map((result) => result.address);

  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new BlockedUrlError(url, "it points to a private address");
  }
}
const REDIRECTS = [301, 302, 303, 307, 308];
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
const MAX_REDIRECTS = 5;

export async function safeFetch(
  url: string,
  init: RequestInit = {},
  fetchFn: typeof fetch = fetch,
  lookupFn: LookupFn = lookupAll
): Promise<Response> {
  let current = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current, lookupFn);
    const response = await fetchFn(current, { ...init, redirect: "manual" });

    const location = response.headers.get("location");
    if (!REDIRECTS.includes(response.status) || !location) {
      return response;
    }

    await response.body?.cancel();
    // "location" can be relative, like "/new-page": resolve it against the current URL
    current = new URL(location, current).toString();
  }

  throw new BlockedUrlError(url, "too many redirects");
}
