import { deleteOldRateLimits, getLinksToCheck, updateLinkStatus } from "@/lib/data";
import { checkLink } from "@/lib/checkLink";

// Vercel Cron calls this address once a day (see vercel.json) and sends
// "Authorization: Bearer <CRON_SECRET>". Anyone else gets 401, so strangers
// can't make the server fetch every saved link on demand.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const links = await getLinksToCheck();
  const results = await Promise.all(
    links.map(async (link) => {
      const status = await checkLink(link.url);
      await updateLinkStatus(link.userId, link.id, status);
      return status;
    })
  );

  // Rate limit counts older than a day are never needed again.
  await deleteOldRateLimits(new Date(Date.now() - 24 * 60 * 60 * 1000));

  return Response.json({
    checked: results.length,
    broken: results.filter((status) => status === "broken").length,
  });
}
