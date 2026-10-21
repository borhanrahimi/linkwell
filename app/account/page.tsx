import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import Avatar from "@/components/Avatar";
import Bookmarklet from "@/components/Bookmarklet";
import DeleteAccount from "@/components/DeleteAccount";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ImportBookmarks from "@/components/ImportBookmarks";
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

            <div className="mt-6 border-t border-line pt-6">
              <h2 className="text-sm font-medium text-ink">Save from anywhere</h2>
              <p className="text-sm text-muted">
                Drag this button to your bookmarks bar. Then click it on any page to save that page to Linkwell.
              </p>
              <Bookmarklet />
            </div>

            <div className="mt-6 border-t border-line pt-6">
              <h2 className="text-sm font-medium text-ink">Export your links</h2>
              <p className="text-sm text-muted">
                Download all your links and folders as a bookmarks file. Every browser and most bookmark apps can
                import it.
              </p>
              {/* A plain <a>, not <Link>: this downloads a file instead of opening a page. */}
              <a href="/api/export" download className="btn-secondary mt-3 inline-block">
                Download bookmarks file
              </a>
            </div>

            <div className="mt-6 border-t border-line pt-6">
              <h2 className="text-sm font-medium text-ink">Import bookmarks</h2>
              <p className="text-sm text-muted">
                Bring in links from your browser or another bookmark app: export your bookmarks there as a file,
                then choose it here. Their folders become Linkwell folders.
              </p>
              <ImportBookmarks />
            </div>

            <div className="mt-6 border-t border-line pt-6">
              <DeleteAccount />
            </div>
          </section>
          <Footer />
        </div>
      </div>
    </main>
  );
}
