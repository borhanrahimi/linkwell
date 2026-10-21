// How much one account may do, so one person (or a script) can't overload
// Linkwell or fill the free database plan.

export const MAX_LINKS = 10_000;
export const MAX_FOLDERS = 200;

// Rate limits for the expensive actions: at most `max` uses per window.
export const RATE_LIMITS = {
  // Saving visits the page to read its title.
  saveLink: { max: 30, windowSeconds: 60 },
  // "Check links" visits every saved link.
  checkLinks: { max: 5, windowSeconds: 60 * 60 },
  // 100 batches of 200 bookmarks: 20,000 links an hour.
  importBookmarks: { max: 100, windowSeconds: 60 * 60 },
  // The old localStorage import, needed once at most.
  importLinks: { max: 5, windowSeconds: 60 * 60 },
} as const;

export type RateLimitedAction = keyof typeof RATE_LIMITS;

export const TOO_FAST = "You're going a bit fast. Please wait a moment and try again.";
export const TOO_MANY_LINKS = `You've reached the limit of ${MAX_LINKS.toLocaleString("en")} links.`;
export const TOO_MANY_FOLDERS = `You've reached the limit of ${MAX_FOLDERS} folders.`;

// Time is cut into fixed windows (each minute, each hour, ...); every use in
// the same window counts toward the same total.
export function windowStart(now: Date, windowSeconds: number): Date {
  const size = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / size) * size);
}
