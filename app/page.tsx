import { headers } from "next/headers";
import LinkManager from "@/components/LinkManager";
import Landing from "@/components/Landing";
import { auth } from "@/lib/auth";
import { getFolders, getLinks } from "@/lib/data";

export default async function Home({ searchParams }: PageProps<"/">) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    // After deleting an account, DeleteAccount sends the visitor to /?deleted=1.
    const { deleted } = await searchParams;
    return <Landing deleted={Boolean(deleted)} />;
  }

  const [links, folders] = await Promise.all([
    getLinks(session.user.id),
    getFolders(session.user.id),
  ]);
  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        {/* LinkManager draws the top bar itself, because the save box in it is part of its state. */}
        <LinkManager initialLinks={links} initialFolders={folders} now={new Date()} user={session.user} />
      </div>
    </main>
  );
}
