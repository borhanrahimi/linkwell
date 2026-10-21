import type { ReactNode } from "react";
import NextLink from "next/link";
import Footer from "@/components/Footer";
import { SITE } from "@/lib/site";

// The frame for the privacy policy and the terms: a way back home, the title,
// when it last changed, and readable text.
export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen px-4 pb-16 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <nav className="py-5">
          <NextLink href="/" className="text-lg font-semibold text-ink">
            Linkwell
          </NextLink>
        </nav>
        <article className="glass mt-4 rounded-2xl p-6 sm:p-10">
          <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 text-sm text-muted">Last updated {SITE.legalUpdated}</p>
          <div className="legal mt-8 space-y-4 text-ink">{children}</div>
        </article>
        <Footer />
      </div>
    </main>
  );
}

// How to reach Linkwell: the contact address once there is one, and always
// the account page, where people can export or delete everything themselves.
export function Contact() {
  return SITE.contactEmail ? (
    <p>
      Questions or requests: write to{" "}
      <a href={`mailto:${SITE.contactEmail}`} className="text-accent hover:underline">
        {SITE.contactEmail}
      </a>
      .
    </p>
  ) : (
    <p>
      You can download or delete everything yourself on your{" "}
      <NextLink href="/account" className="text-accent hover:underline">
        account page
      </NextLink>
      , at any time.
    </p>
  );
}
