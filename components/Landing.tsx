import type { ReactNode } from "react";
import NextLink from "next/link";
import Footer from "@/components/Footer";
import SignInButton from "@/components/SignInButton";
import EmptyBox from "@/components/illustrations/EmptyBox";
import LinkDoctor from "@/components/illustrations/LinkDoctor";
import Stargazer from "@/components/illustrations/Stargazer";
import Wave from "@/components/illustrations/Wave";

// What a visitor who isn't signed in sees: what Linkwell is, its three
// promises, how saving works, and a few honest answers. A Server Component:
// only the sign-in buttons need JavaScript.

const PROMISES: { title: string; text: string; drawing: ReactNode }[] = [
  {
    title: "Save links",
    text: "Paste a link, or send it from your browser or phone. Add tags, a folder and a note about why you saved it.",
    drawing: <EmptyBox className="mx-auto w-48" />,
  },
  {
    title: "Keep them alive",
    text: "Every day, Linkwell checks that your links still work. When a page disappears, you get an archived copy instead.",
    drawing: <LinkDoctor className="mx-auto w-48" />,
  },
  {
    title: "Actually come back to them",
    text: "Mark links as read, and Rediscover brings back the ones you saved weeks ago and forgot.",
    drawing: <Stargazer className="mx-auto w-48" />,
  },
];

const WAYS_TO_SAVE: { title: string; text: string }[] = [
  { title: "Any browser", text: "Drag the Save to Linkwell button to your bookmarks bar, and click it on any page." },
  { title: "Your phone", text: "Add Linkwell to your Home Screen, and share links to it straight from other apps." },
  { title: "Copy and paste", text: "Copy a link anywhere, open Linkwell and tap Paste. One tap, then Save." },
  { title: "Your old bookmarks", text: "Import the bookmarks file from your browser or another bookmark app, folders and all." },
];

const QUESTIONS: { question: string; answer: string }[] = [
  {
    question: "Is Linkwell free?",
    answer: "Yes. Sign in and start saving. There are no ads, and your links are never sold.",
  },
  {
    question: "Who can see my links?",
    answer: "Only you. Your links and folders belong to your account, and every request is checked so nobody else can read or change them.",
  },
  {
    question: "Can I take my links with me?",
    answer:
      "Any time. The account page downloads all your links and folders as a bookmarks file that every browser and most bookmark apps can import. You can also delete your account, and everything in it goes too.",
  },
  {
    question: "How is it different from other bookmark apps?",
    answer:
      "Most bookmark tools are where links go to die. Linkwell checks that your links still work, offers an archived copy when one breaks, and brings back the ones you forgot.",
  },
  {
    question: "Is it safe?",
    answer:
      "Linkwell never sees or stores a password. Everything sent to the server is checked again there, busy actions are rate limited, and pages only run Linkwell's own scripts.",
  },
];

export default function Landing({ deleted = false }: { deleted?: boolean }) {
  return (
    <main className="min-h-screen px-4 pb-16 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <nav className="flex items-center justify-between py-5">
          <span className="text-lg font-semibold text-ink">Linkwell</span>
          <SignInButton label="Sign in" className="btn-secondary" />
        </nav>

        {/* The promise, and the one thing to do. */}
        <section className="mx-auto mt-8 max-w-2xl text-center">
          {/* Waving hello, or goodbye after an account was deleted. */}
          <Wave goodbye={deleted} className="mx-auto w-52" />
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Save links. Keep them alive. Actually come back to them.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
            Linkwell is a calm place for the links you want to keep. It checks they still work, and brings old ones back
            when you&apos;ve forgotten them.
          </p>
          <SignInButton />
          {deleted ? (
            <p role="status" className="mt-4 text-sm text-muted">
              Your account and all your links were deleted. Goodbye
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Free to use. By signing in, you agree to the{" "}
              <NextLink href="/terms" className="underline hover:text-ink">
                terms
              </NextLink>{" "}
              and the{" "}
              <NextLink href="/privacy" className="underline hover:text-ink">
                privacy policy
              </NextLink>
              .
            </p>
          )}
        </section>

        {/* The three promises. */}
        <section aria-labelledby="promises-heading" className="mt-20">
          <h2 id="promises-heading" className="sr-only">
            What Linkwell does
          </h2>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {PROMISES.map((promise) => (
              <li key={promise.title} className="glass rounded-2xl p-6 text-center">
                {promise.drawing}
                <h3 className="mt-4 text-lg font-semibold text-ink">{promise.title}</h3>
                <p className="mt-1 text-muted">{promise.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="anywhere-heading" className="mt-20">
          <h2 id="anywhere-heading" className="text-center text-2xl font-semibold text-ink">
            Save from anywhere
          </h2>
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {WAYS_TO_SAVE.map((way) => (
              <li key={way.title} className="glass rounded-2xl p-5">
                <h3 className="font-semibold text-ink">{way.title}</h3>
                <p className="mt-1 text-sm text-muted">{way.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="faq-heading" className="mx-auto mt-20 max-w-2xl">
          <h2 id="faq-heading" className="text-center text-2xl font-semibold text-ink">
            Questions
          </h2>
          {/* <details> opens and closes without any JavaScript. */}
          <div className="glass mt-6 divide-y divide-line rounded-2xl">
            {QUESTIONS.map((item) => (
              <details key={item.question} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
                  {item.question}
                  <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-20 text-center">
          <h2 className="text-2xl font-semibold text-ink">Give your links a home</h2>
          <SignInButton label="Start saving links" />
        </section>

        <Footer />
      </div>
    </main>
  );
}
