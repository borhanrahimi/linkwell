import type { LinkStatus } from "@/types/link";

const GONE = [404, 410];
const UNREACHABLE = ["ENOTFOUND", "ECONNREFUSED"];

export async function checkLink(
  url: string,
  fetchFn: typeof fetch = fetch
): Promise<LinkStatus> {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return "broken";
  }

  try {
    const response = await fetchFn(url, {
      signal: AbortSignal.timeout(10_000),
    });
    await response.body?.cancel();
    return GONE.includes(response.status) ? "broken" : "ok";
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    return code && UNREACHABLE.includes(code) ? "broken" : "ok";
  }
}
