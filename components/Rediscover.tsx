"use client";

import { useState } from "react";
import type { Link } from "@/types/link";
import { getDomain, timeAgo } from "@/lib/links";
import Spyglass from "@/components/illustrations/Spyglass";

type RediscoverProps = {
  links: Link[];
  now: Date;
  className?: string;
};

// A slim banner above the list: one old, unread link at a time, with "Show
// another" to flip to the next. It stays out of the way, but always there.
export default function Rediscover({ links, now, className = "" }: RediscoverProps) {
  const [turn, setTurn] = useState(0);

  if (links.length === 0) {
    return null;
  }
  // Links leave the list once read, so wrap round instead of running off the end.
  const link = links[turn % links.length];

  return (
    <section
      aria-labelledby="rediscover-heading"
      className={`glass flex items-center gap-3 rounded-2xl py-2 pl-2 pr-3 ring-1 ring-highlight/30 sm:gap-4 sm:pr-4 ${className}`}
    >
      <Spyglass className="w-20 shrink-0 sm:w-28" />
      <div className="min-w-0 flex-1">
        <h2 id="rediscover-heading" className="text-xs font-semibold uppercase tracking-wide text-highlight">
          Rediscover{" "}
          <span className="hidden font-normal normal-case tracking-normal sm:inline">· Remember this one?</span>
        </h2>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate font-medium text-highlight hover:underline"
        >
          {link.title || getDomain(link.url)}
        </a>
        <p className="truncate text-sm text-muted">
          {getDomain(link.url)} · saved {timeAgo(link.createdAt, now)}
        </p>
      </div>
      {links.length > 1 && (
        // On phones, a round arrow button leaves the title room; its name stays "Show another".
        <button
          onClick={() => setTurn((current) => current + 1)}
          aria-label="Show another"
          className="btn-secondary px-2.5 sm:px-4"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="size-4 sm:hidden"
          >
            <path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4.6h-4.6" />
          </svg>
          <span className="hidden sm:inline">Show another</span>
        </button>
      )}
    </section>
  );
}
