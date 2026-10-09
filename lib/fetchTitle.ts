const ENTITIES: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&#x27;": "'",
    "&nbsp;": " ",
  };
  
  export function readTitle(html: string): string | undefined {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match) {
      return undefined;
    }
    const title = match[1]
      .replace(/&[#\w]+;/g, (entity) => ENTITIES[entity] ?? entity)
      .replace(/\s+/g, " ")
      .trim();
    return title.slice(0, 200) || undefined;
  }
  
  export async function fetchTitle(url: string, fetchFn: typeof fetch = fetch): Promise<string | undefined> {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return undefined;
    }
  
    try {
      const response = await fetchFn(url, { signal: AbortSignal.timeout(5_000) });
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
        await response.body?.cancel();
        return undefined;
      }
      return readTitle(await response.text());
    } catch {
      return undefined;
    }
  }
  