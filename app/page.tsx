import { headers } from "next/headers";
import LinkManager from "@/components/LinkManager";
import SignInButton from "@/components/SignInButton";
import Header from "@/components/Header";
import { auth } from "@/lib/auth";
import { getFolders, getLinks } from "@/lib/data";

export default async function Home({ searchParams }: PageProps<"/">) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    // After deleting an account, DeleteAccount sends the visitor to /?deleted=1.
    const { deleted } = await searchParams;
    return (
      <main className="min-h-screen p-8">
        <div className="glass mx-auto mt-16 max-w-md rounded-2xl p-8 text-center">
          <h1 className="text-3xl font-bold text-ink">Linkwell</h1>
          <p className="mt-1 text-muted">
            Save links. Keep them alive. Actually come back to them.
          </p>
          <SignInButton />
          {deleted && (
            <p role="status" className="mt-4 text-sm text-muted">
              Your account and all your links were deleted. Goodbye
            </p>
          )}
        </div>
      </main>
    );
  }

  const [links, folders] = await Promise.all([
    getLinks(session.user.id),
    getFolders(session.user.id),
  ]);
  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <Header user={session.user} />
        {/* Visible headings start at the tiles; screen readers still get a page title. */}
        <h1 className="sr-only">Your links</h1>
        <LinkManager initialLinks={links} initialFolders={folders} now={new Date()} />
      </div>
    </main>
  );
}
