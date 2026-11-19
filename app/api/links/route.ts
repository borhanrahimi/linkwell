import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { countMatching, getAllMatching, getLinkPage } from "@/lib/data";
import { queryFromParams } from "@/lib/linkQuery";
import { MAX_LINKS } from "@/lib/limits";

// GET /api/links?list=unread&folder=…&tag=…&q=…&sort=newest
//   one page of the signed-in user's links (a LinkPage); &after=… for the next one.
// GET /api/links?…&all=1
//   every link the list has, for Select all ({ links }).
// GET /api/links?…&count=1
//   just how many links the list has ({ total }), after a change.
// The question comes from the address, so it's read with queryFromParams,
// which keeps only what it understands. Answers are never cached: they're private.
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Please sign in first." }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const query = queryFromParams(params);
  const answer = params.get("all")
    ? { links: await getAllMatching(session.user.id, query, MAX_LINKS) }
    : params.get("count")
      ? { total: await countMatching(session.user.id, query) }
      : await getLinkPage(session.user.id, query, params.get("after"));
  return Response.json(answer, { headers: { "Cache-Control": "no-store" } });
}
