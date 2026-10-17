import type { LinkStatus } from "@/types/link";
import { BlockedUrlError, safeFetch, type FetchFn } from "@/lib/safeUrl";

const GONE = [404, 410];
const UNREACHABLE = ["ENOTFOUND", "ECONNREFUSED"];

export async function checkLink(
  url: string,
  fetchFn: FetchFn = safeFetch
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
    if (error instanceof BlockedUrlError) {
      return "broken";
    }
    // DNS errors carry the code themselves; fetch errors carry it in "cause"
    const { code, cause } = error as { code?: string; cause?: { code?: string } };
    const reason = code ?? cause?.code;
    return reason && UNREACHABLE.includes(reason) ? "broken" : "ok";
  }
}
