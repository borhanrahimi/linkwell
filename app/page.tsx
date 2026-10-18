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
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold text-slate-900">Linkwell</h1>
          <p className="mt-1 text-slate-500">
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
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Linkwell</h1>
          <p className="mt-1 text-slate-500">
            Save links. Keep them alive. Actually come back to them.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>Signed in as {session.user.name || session.user.email}</span>
          <SignOutButton />
        </div>
      </header>
        <LinkManager initialLinks={links} initialFolders={folders} now={new Date()} />
      </div>
    </main>
  );
}
