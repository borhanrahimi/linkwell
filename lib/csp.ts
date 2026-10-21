// The Content-Security-Policy: the browser's list of what a Linkwell page may
// load and run. If someone ever manages to put a <script> into a page (say,
// through a title we forgot to escape), the browser refuses to run it.
//
// Scripts need a nonce: a random code made fresh for every page view. Next.js
// puts it on its own scripts (it reads it from this header), so only those run.
export function buildCsp(nonce: string, isDev = false): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic': scripts that a trusted (nonce) script loads are trusted
    // too. In development React also needs 'unsafe-eval' for its error stacks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // <style> tags need the nonce; style="" attributes (Avatar's size) are
    // allowed. The dev server injects CSS without a nonce, so development
    // allows inline styles instead (a nonce would switch 'unsafe-inline' off).
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "style-src-attr 'unsafe-inline'",
    // Site icons come from Google's favicon service (which redirects to
    // gstatic.com), profile pictures from googleusercontent.com.
    "img-src 'self' data: blob: https://www.google.com https://*.gstatic.com https://*.googleusercontent.com",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Never inside someone else's page (clickjacking).
    "frame-ancestors 'none'",
  ].join("; ");
}

// Headers for every response, pages and API alike (set in next.config.ts).
export const SECURITY_HEADERS = [
  // Never inside a frame, for browsers too old for frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  // Treat files as the type the server says, never guess (no "this text looks like a script").
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites only learn that a visitor came from Linkwell, never which page.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // HTTPS only, for two years, including subdomains.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Features Linkwell never uses stay off. (Not the clipboard: Paste reads it.)
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  // A window Linkwell opens can't reach back into Linkwell, and the other way round.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];
