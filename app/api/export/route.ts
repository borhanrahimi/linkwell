import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { toBookmarksHtml } from "@/lib/bookmarks";
import { getFolders, getLinks } from "@/lib/data";

// GET /api/export downloads the signed-in user's links as a bookmarks file.
// The account page links here; the browser saves the answer as a file
// because of the Content-Disposition header.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Please sign in first.", { status: 401 });
  }

  const [links, folders] = await Promise.all([getLinks(session.user.id), getFolders(session.user.id)]);
  const today = new Date().toISOString().slice(0, 10);

  return new Response(toBookmarksHtml(links, folders), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="linkwell-bookmarks-${today}.html"`,
      // Your links are private: don't let a browser or proxy keep a copy.
      "Cache-Control": "no-store",
    },
  });
}
