"use client";

import { useState } from "react";
import { checkAllLinks } from "@/app/actions";
import type { Link } from "@/types/link";

type CheckLinksButtonProps = {
  onChecked: (links: Link[]) => void;
};

export default function CheckLinksButton({ onChecked }: CheckLinksButtonProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setIsChecking(true);
    setMessage(null);

    const checked = await checkAllLinks();
    const broken = checked.filter((link) => link.status === "broken").length;
    const total = `${checked.length} ${checked.length === 1 ? "link" : "links"}`;

    onChecked(checked);
    setMessage(broken === 0 ? `Checked ${total}: all working.` : `Checked ${total}: ${broken} broken.`);
    setIsChecking(false);
  }

  return (
    <div className="mt-3 flex items-center gap-3 text-sm">
      <button
        onClick={handleClick}
        disabled={isChecking}
        className="rounded border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-700 shadow-sm hover:bg-slate-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
      >
        {isChecking ? "Checking..." : "Check links"}
      </button>
      {message && (
        <p role="status" className="text-slate-500">
          {message}
        </p>
      )}
    </div>
  );
}
