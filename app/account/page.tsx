import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import Avatar from "@/components/Avatar";
import Header from "@/components/Header";
import UsernameForm from "@/components/UsernameForm";
import { auth } from "@/lib/auth";

export const metadata = { title: "Your account · Linkwell" };

export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }
  const { user } = session;
  const joined = user.createdAt.toLocaleDateString("en", { month: "long", year: "numeric" });

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <Header user={user} />

        <div className="mx-auto mt-8 max-w-xl">
          <Link href="/" className="text-sm font-medium text-accent hover:underline">
            ← Your links
          </Link>

          <section aria-labelledby="profile-heading" className="glass mt-3 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <Avatar name={user.name} image={user.image} size={64} />
              <div className="min-w-0">
                <h1 id="profile-heading" className="truncate text-xl font-semibold text-ink">
                  {user.name}
                </h1>
                <p className="truncate text-sm text-muted">{user.email}</p>
                <p className="text-sm text-muted">Joined {joined}</p>
              </div>
            </div>

            <div className="mt-6 border-t border-line pt-6">
              <UsernameForm initialUsername={user.username} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
