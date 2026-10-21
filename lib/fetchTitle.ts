import { safeFetch, type FetchFn } from "@/lib/safeUrl";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": " ",
};

const TITLE_MAX = 200;

// Sites that answer "what is this link called?" through oEmbed, a small
// standard service that returns a link's title as JSON. Big video sites often
// send a cut-down "are you a robot?" page to servers (its title is just
// " - YouTube"), but their oEmbed service still answers, so it's asked first.
const OEMBED_PROVIDERS: { hosts: RegExp; endpoint: string }[] = [
  {
    hosts: /^((www|m|music)\.)?youtube\.com$|^youtu\.be$/,
    endpoint: "https://www.youtube.com/oembed?format=json&url=",
  },
  { hosts: /^(www\.|player\.)?vimeo\.com$/, endpoint: "https://vimeo.com/api/oembed.json?url=" },
];

function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&\w+;/g, (entity) => ENTITIES[entity.toLowerCase()] ?? entity);
}

// Tidies a title, and drops ones that say nothing: empty, or only the site's
// name after a dash, like " - YouTube" or "| News".
function clean(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const title = decode(raw).replace(/\s+/g, " ").trim();
  if (!title || /^[-–—|·:•]/.test(title)) return undefined;
  return title.slice(0, TITLE_MAX);
}

// The attributes of every <meta> or <link> tag, as { name: value } objects.
function tags(html: string, tag: "meta" | "link"): Record<string, string>[] {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "gi"))].map(([element]) => {
    const attributes: Record<string, string> = {};
    for (const [, name, double, single] of element.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attributes[name.toLowerCase()] = double ?? single;
    }
    return attributes;
  });
}

// The page's title. Sharing tags (og:title and friends) come first: they hold
// just the title, without " - Site name" on the end.
export function readTitle(html: string): string | undefined {
  const metas = tags(html, "meta");
  for (const key of ["og:title", "twitter:title", "title"]) {
    const meta = metas.find((m) => (m.property ?? m.name)?.toLowerCase() === key);
    const title = clean(meta?.content);
    if (title) return title;
  }
  return clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
}

// The page's own pointer to its oEmbed service, if it has one.
export function readOembedUrl(html: string, pageUrl: string): string | undefined {
  const link = tags(html, "link").find(
    (l) => l.rel?.toLowerCase() === "alternate" && l.type?.toLowerCase() === "application/json+oembed" && l.href
  );
  if (!link) return undefined;
  try {
    return new URL(decode(link.href), pageUrl).toString();
  } catch {
    return undefined;
  }
}

function knownOembedUrl(url: string): string | undefined {
  const host = new URL(url).hostname.toLowerCase();
  const provider = OEMBED_PROVIDERS.find((p) => p.hosts.test(host));
  return provider && provider.endpoint + encodeURIComponent(url);
}

async function fetchOembedTitle(oembedUrl: string, fetchFn: FetchFn): Promise<string | undefined> {
  try {
    const response = await fetchFn(oembedUrl, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok || !response.headers.get("content-type")?.includes("json")) {
      await response.body?.cancel();
      return undefined;
    }
    const data: unknown = await response.json();
    const title = (data as { title?: unknown } | null)?.title;
    return typeof title === "string" ? clean(title) : undefined;
  } catch {
    return undefined;
  }
}

export async function fetchTitle(url: string, fetchFn: FetchFn = safeFetch): Promise<string | undefined> {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return undefined;
  }

  try {
    const known = knownOembedUrl(url);
    if (known) {
      const title = await fetchOembedTitle(known, fetchFn);
      if (title) return title;
    }

    const response = await fetchFn(url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
      await response.body?.cancel();
      return undefined;
    }
    const html = await response.text();
    const title = readTitle(html);
    if (title) return title;

    // No useful title on the page: ask its oEmbed service, if it names one.
    const oembed = readOembedUrl(html, url);
    return oembed && oembed !== known ? await fetchOembedTitle(oembed, fetchFn) : undefined;
  } catch {
    return undefined;
  }
}
