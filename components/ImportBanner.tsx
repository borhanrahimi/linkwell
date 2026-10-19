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
    <div className="glass mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-3 text-sm text-muted">
      <p>
        You have {oldLinks.length} {oldLinks.length === 1 ? "link" : "links"} saved in this
        browser from before. Import them into Linkwell?
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={handleImport}
          disabled={isImporting}
          className="btn-primary"
        >
          {isImporting ? "Importing..." : "Import"}
        </button>
        <button
          onClick={() => setOldLinks([])}
          disabled={isImporting}
          className="btn-quiet"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
