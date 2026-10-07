import LinkManager from "@/components/LinkManager";
import { getLinks } from "@/lib/data";

export default async function Home() {
  const links = await getLinks();

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold text-slate-900">Linkwell</h1>
        <p className="mt-1 text-slate-500">
          Save links. Keep them alive. Actually come back to them.
        </p>

        <LinkManager initialLinks={links} now={new Date()}/>
      </div>
    </main>
  );
}
