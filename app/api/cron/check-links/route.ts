import { deleteOldRateLimits, getLinksToCheck, getLinksWithoutImage, updateLinkImage, updateLinkStatus } from "@/lib/data";
import { checkLink } from "@/lib/checkLink";
import { fetchPageInfo } from "@/lib/fetchTitle";

// Preview pictures for links saved before Linkwell looked for them: a batch
// a day, so the job stays short.
const IMAGES_PER_RUN = 50;

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

  const withoutImage = await getLinksWithoutImage(IMAGES_PER_RUN);
  await Promise.all(
    withoutImage.map(async (link) => {
      const { image } = await fetchPageInfo(link.url);
      await updateLinkImage(link.userId, link.id, image ?? "");
    })
  );

  // Rate limit counts older than a day are never needed again.
  await deleteOldRateLimits(new Date(Date.now() - 24 * 60 * 60 * 1000));

  return Response.json({
    checked: results.length,
    broken: results.filter((status) => status === "broken").length,
    imagesLookedFor: withoutImage.length,
  });
}
