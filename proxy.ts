import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "@/lib/csp";

// Runs before every page: makes a fresh nonce, and sends the
// Content-Security-Policy with it. Next.js reads the nonce from the request's
// header and puts it on its own scripts while rendering the page.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Pages only: not API routes, built files, icons or the manifest, and not
    // link prefetches (they'd make a nonce nobody uses).
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|icon-|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
