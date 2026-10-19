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
    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
      <button
        onClick={handleClick}
        disabled={isChecking}
        className="btn-secondary"
      >
        {isChecking ? "Checking..." : "Check links"}
      </button>
      {message && (
        <p role="status" className="text-muted">
          {message}
        </p>
      )}
    </div>
  );
}
