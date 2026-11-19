import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getLinkSummary } from "@/lib/data";

// GET /api/links/summary: the signed-in user's counts, tags and Home's few
// links (a LinkSummary). The page asks again after each change, so the
// sidebar's numbers catch up with what was done.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Please sign in first." }, { status: 401 });
  }
  return Response.json(await getLinkSummary(session.user.id), { headers: { "Cache-Control": "no-store" } });
}
