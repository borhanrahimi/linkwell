import { headers } from "next/headers";
import LinkManager from "@/components/LinkManager";
import SignInButton from "@/components/SignInButton";
import SignOutButton from "@/components/SignOutButton";
import { auth } from "@/lib/auth";
import { getFolders, getLinks } from "@/lib/data";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return (
      <main className="min-h-screen p-8">
        <div className="glass mx-auto mt-16 max-w-md rounded-2xl p-8 text-center">
          <h1 className="text-3xl font-bold text-ink">Linkwell</h1>
          <p className="mt-1 text-muted">
            Save links. Keep them alive. Actually come back to them.
          </p>
          <SignInButton />
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
        {/* A floating glass bar that stays at the top while the links scroll underneath. */}
        <header className="glass-bar sticky top-3 z-10 flex items-center justify-between gap-4 rounded-full py-2 pl-5 pr-2">
          <h1 className="text-lg font-semibold tracking-tight text-ink">Linkwell</h1>
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted">
            <span className="truncate">Signed in as {session.user.name || session.user.email}</span>
            <SignOutButton />
          </div>
        </header>
        <LinkManager initialLinks={links} initialFolders={folders} now={new Date()} />
      </div>
    </main>
  );
}
