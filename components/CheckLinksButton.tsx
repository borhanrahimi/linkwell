"use client";

import { useState } from "react";
import { useLinkActions } from "@/components/LinkActions";
import type { Link } from "@/types/link";

type CheckLinksButtonProps = {
  onChecked: (links: Link[]) => void;
};

export default function CheckLinksButton({ onChecked }: CheckLinksButtonProps) {
  const { checkAllLinks } = useLinkActions();
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setIsChecking(true);
    setMessage(null);

    const checked = await checkAllLinks();
    if (typeof checked === "string") {
      // Checked too often: the server says when to try again.
      setMessage(checked);
      setIsChecking(false);
      return;
    }
    const broken = checked.filter((link) => link.status === "broken").length;
    const total = `${checked.length} ${checked.length === 1 ? "link" : "links"}`;

    onChecked(checked);
    setMessage(broken === 0 ? `Checked ${total}: all working.` : `Checked ${total}: ${broken} broken.`);
    setIsChecking(false);
  }

  return (
    // A quiet row under the lists, like them; what it found shows below it.
    <div className="mt-0.5">
      <button onClick={handleClick} disabled={isChecking} className="sidebar-item font-normal text-muted hover:text-ink disabled:opacity-60">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`size-4 shrink-0 ${isChecking ? "motion-safe:animate-spin" : ""}`}>
          <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4" />
        </svg>
        {isChecking ? "Checking..." : "Check links"}
      </button>
      {message && (
        <p role="status" className="px-2 pb-1 pl-8 text-xs text-muted">
          {message}
        </p>
      )}
    </div>
  );
}
