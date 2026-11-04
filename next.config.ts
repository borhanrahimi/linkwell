import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./lib/csp";

const nextConfig: NextConfig = {
  // The "N" badge you only see while developing. Its usual corner,
  // bottom-left, sits on the phone tab bar's Home and catches the tap; over
  // the logo (which only goes Home too) it's out of the way.
  devIndicators: { position: "top-left" },
  // The Content-Security-Policy is set per page in proxy.ts (it needs a fresh
  // nonce each time); these headers are the same for every response.
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
