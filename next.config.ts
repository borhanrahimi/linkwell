import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./lib/csp";

const nextConfig: NextConfig = {
  // The Content-Security-Policy is set per page in proxy.ts (it needs a fresh
  // nonce each time); these headers are the same for every response.
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
