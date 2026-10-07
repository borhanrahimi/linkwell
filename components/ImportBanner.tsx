"use client";

import { useEffect, useState } from "react";
import { importLinks } from "@/app/actions";
import { clearSavedLinks, loadLinks } from "@/lib/links";
import type { Link } from "@/types/link";

type ImportBannerProps = {
  onImported: (links: Link[]) => void;
};

export default function ImportBanner({ onImported }: ImportBannerProps) {
  const [oldLinks, setOldLinks] = useState<Link[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    // localStorage only exists in the browser, so it's read after the first render
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOldLinks(loadLinks());
  }, []);

  async function handleImport() {
    setIsImporting(true);
    const imported = await importLinks(oldLinks);
    clearSavedLinks();
    setOldLinks([]);
    onImported(imported);
  }

  if (oldLinks.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 flex items-center justify-between gap-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p>
        You have {oldLinks.length} {oldLinks.length === 1 ? "link" : "links"} saved in this
        browser from before. Import them into Linkwell?
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={handleImport}
          disabled={isImporting}
          className="rounded bg-amber-600 px-3 py-1 font-semibold text-white hover:bg-amber-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1"
        >
          {isImporting ? "Importing..." : "Import"}
        </button>
        <button
          onClick={() => setOldLinks([])}
          disabled={isImporting}
          className="rounded px-3 py-1 font-semibold text-amber-900 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
