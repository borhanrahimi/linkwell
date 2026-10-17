import { describe, expect, test } from "vitest";
import { isPrivateAddress } from "../lib/safeUrl";

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
