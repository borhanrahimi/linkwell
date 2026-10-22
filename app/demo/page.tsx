import { connection } from "next/server";
import DemoApp from "@/components/DemoApp";

export const metadata = {
  title: "Try it",
  description: "Try Linkwell with sample links, no account needed. Nothing you do here is saved.",
};

// /demo: Linkwell without an account, for anyone who wants to look around
// first (and for reviewers). Sample links, all changes stay in the browser.
export default async function DemoPage() {
  // Rendered per visit, so the sample links' dates ("2 days ago") stay fresh.
  await connection();
  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <p role="note" className="mb-3 text-center text-sm text-muted">
          This is a demo with sample links. Try anything: nothing is saved, and a refresh starts over.
        </p>
        <DemoApp now={new Date()} />
      </div>
    </main>
  );
}
