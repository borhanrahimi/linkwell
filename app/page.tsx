import { headers } from "next/headers";
import LinkManager from "@/components/LinkManager";
import Landing from "@/components/Landing";
import { auth } from "@/lib/auth";
import { readAddress } from "@/lib/address";
import { getFolders, getLinkPage, getLinkSummary, getTrash } from "@/lib/data";
import { addNewLinks, queryKey, shownQuery } from "@/lib/linkQuery";

export default async function Home({ searchParams }: PageProps<"/">) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    // After deleting an account, DeleteAccount sends the visitor to /?deleted=1.
    const { deleted } = await searchParams;
    return <Landing deleted={Boolean(deleted)} />;
  }

  // The list, folder, tag and view chosen in the address, for the first render.
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const userId = session.user.id;
  const now = new Date();
  // Not every link (v2.5): the counts and Home's few links (the summary), and
  // the first page of the list in the address, if one is shown. The rest
  // come a page at a time as you scroll (/api/links).
  const [folders, trash, summary] = await Promise.all([getFolders(userId), getTrash(userId), getLinkSummary(userId, now)]);
  const query = shownQuery(folders, readAddress(params.toString()));
  const page = query ? await getLinkPage(userId, query) : null;
  const links = addNewLinks(page?.links ?? [], [...summary.unreadLinks, ...summary.recentLinks, ...summary.rediscoverLinks]);
  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        {/* LinkManager draws the top bar itself, because the save box in it is part of its state. */}
        <LinkManager
          initialLinks={links}
          initialSummary={summary}
          initialPage={query && page ? { key: queryKey(query), page } : null}
          initialFolders={folders}
          initialTrash={trash}
          now={now}
          user={session.user}
          initialSearch={params.toString()}
        />
      </div>
    </main>
  );
}
