"use client";

import type { Ref } from "react";
import type { SmartList } from "@/lib/links";

type BottomBarProps = {
  activeList: SmartList;
  inFolder: boolean;
  onSelectList: (list: SmartList) => void;
  onSave: () => void;
  onOpenLists: () => void;
  listsOpen: boolean;
  listsButton: Ref<HTMLButtonElement>;
};

// Phones only: the main places within thumb's reach, like most phone apps.
// All links, Unread, a big + to save a link, and Lists (folders and tags, in
// the sidebar's drawer). Wider screens have the sidebar and the top bar.
export default function BottomBar({ activeList, inFolder, onSelectList, onSave, onOpenLists, listsOpen, listsButton }: BottomBarProps) {
  const tab = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
      active ? "text-accent" : "text-muted"
    }`;
  const icon = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, className: "size-6" };

  return (
    <nav
      aria-label="Phone menu"
      className="glass-bar fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 flex items-center gap-1 rounded-[1.75rem] px-2 py-1.5 md:hidden"
    >
      <button onClick={() => onSelectList("all")} aria-label="Show all links" aria-pressed={activeList === "all" && !inFolder} className={tab(activeList === "all" && !inFolder)}>
        <svg {...icon}>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        All
      </button>
      <button onClick={() => onSelectList("unread")} aria-label="Show unread links" aria-pressed={activeList === "unread" && !inFolder} className={tab(activeList === "unread" && !inFolder)}>
        <svg {...icon}>
          <path d="M5 4h14v17l-7-4-7 4Z" />
        </svg>
        Unread
      </button>
      <button
        onClick={onSave}
        aria-label="Save a link"
        className="mx-1 grid size-14 shrink-0 -translate-y-3 place-items-center rounded-full bg-[#0071e3] text-white shadow-lg shadow-black/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
      >
        <svg {...icon} className="size-7" strokeWidth={2.5}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button onClick={onOpenLists} ref={listsButton} aria-label="Lists" aria-expanded={listsOpen} aria-controls="sidebar" className={tab(inFolder)}>
        <svg {...icon}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        </svg>
        Lists
      </button>
    </nav>
  );
}
