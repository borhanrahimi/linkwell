import { BlockList, isIP } from "node:net";

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
