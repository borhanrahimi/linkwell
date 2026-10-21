import { headers } from "next/headers";
import NextLink from "next/link";
import ShareForm from "@/components/ShareForm";
import SignInButton from "@/components/SignInButton";
import { auth } from "@/lib/auth";
import { getFolders } from "@/lib/data";
import { findSharedUrl, firstValue, shareAddress } from "@/lib/share";

// The one place every "save from anywhere" tool sends links to:
// /share?url=...&title=... (the iPhone Shortcut, the Android share menu and
// the bookmarklet all open this page).
export default async function SharePage({ searchParams }: PageProps<"/share">) {
  const params = await searchParams;
  const url = findSharedUrl(params.url, params.text);
  const title = firstValue(params.title)?.trim() ?? "";
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="min-h-screen p-8">
      <div className="glass mx-auto mt-16 max-w-md rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-bold text-ink">Save to Linkwell</h1>
        {!url ? (
          <>
            <p className="mt-2 text-muted">There is no link to save here.</p>
            <NextLink href="/" className="btn-secondary mt-6 inline-block">
              Go to my links
            </NextLink>
          </>
        ) : !session ? (
          <>
            <p className="mt-2 break-all text-muted">
              Sign in to save {url}
            </p>
            <SignInButton callbackURL={shareAddress(url, title)} />
          </>
        ) : (
          <ShareForm url={url} title={title} initialFolders={await getFolders(session.user.id)} />
        )}
      </div>
    </main>
  );
}
