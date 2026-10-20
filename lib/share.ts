// Helpers for /share, the page other apps and shortcuts send links to.

type Param = string | string[] | undefined;

// A search param can appear more than once (?a=1&a=2); we only want the first.
export function firstValue(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Finds the shared link. Android puts it in `url`, but many apps put it in
// `text`, often with words around it ("Look at this https://...").
// Only http and https links count, so nothing like javascript: gets saved.
export function findSharedUrl(...values: Param[]): string | null {
  for (const value of values) {
    const match = firstValue(value)?.match(/https?:\/\/\S+/i);
    if (!match) continue;
    try {
      return new URL(match[0]).href;
    } catch {
      // Looked like a link but isn't one; try the next value.
    }
  }
  return null;
}

// The address to come back to after signing in, so the link isn't lost.
export function shareAddress(url: string, title: string): string {
  const params = new URLSearchParams({ url });
  if (title) params.set("title", title);
  return `/share?${params}`;
}

// The bookmarklet: a bookmark whose address is a bit of JavaScript. Clicking
// it on any page opens /share in a new tab with that page's address and title.
// If the browser blocks the new tab, it opens /share in the same tab instead.
export function bookmarkletCode(origin: string): string {
  const share = JSON.stringify(`${origin}/share?url=`);
  return (
    "javascript:(()=>{" +
    `const u=${share}+encodeURIComponent(location.href)+"&title="+encodeURIComponent(document.title);` +
    'window.open(u,"_blank")||(location.href=u)})()'
  );
}
