"use client";

import { useEffect, useState, type ReactNode, type Ref } from "react";
import NextLink from "next/link";
import type { SmartList } from "@/lib/links";

type BottomBarProps = {
  activeList: SmartList;
  inFolder: boolean;
  onSelectList: (list: SmartList) => void;
  onSave: () => void;
  // Folders opens the sidebar (folders, lists and tags) full screen.
  onOpenFolders: () => void;
  foldersOpen: boolean;
  foldersButton: Ref<HTMLButtonElement>;
  // Where "You" goes: the account page, or (in the demo) signing in.
  accountHref: string;
  accountLabel: string;
};

// Where the sliding highlight sits for each tab (the + is in the middle).
const SLOT = { home: 0, folders: 1, unread: 3 } as const;

// Phones only: the main places within thumb's reach, like most phone apps.
// Home, Folders, a big + to save a link, Unread, and You. A floating bar of
// frosted glass (glass-bar: the page blurs behind it), lifted off the bottom
// edge and clear of the iPhone's home line. A soft pill glides to the tab you
// tap; the bar slides away while you scroll down to read and comes back when
// you scroll up. Wider screens have the sidebar and the top bar instead.
export default function BottomBar({ activeList, inFolder, onSelectList, onSave, onOpenFolders, foldersOpen, foldersButton, accountHref, accountLabel }: BottomBarProps) {
  const [hidden, setHidden] = useState(false);
  // The tab that was just tapped bounces; a new number starts it again.
  const [tapped, setTapped] = useState<{ tab: string; count: number } | null>(null);

  useEffect(() => {
    let lastY = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      // A little leeway, so a shaky thumb doesn't flicker it.
      if (y > lastY + 8 && y > 80) setHidden(true);
      else if (y < lastY - 4) setHidden(false);
      if (Math.abs(y - lastY) > 4) lastY = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const active = foldersOpen || inFolder ? "folders" : activeList === "home" || activeList === "unread" ? activeList : null;

  function tap(tab: string, action: () => void) {
    setTapped((current) => ({ tab, count: (current?.count ?? 0) + 1 }));
    action();
  }

  const tab = (name: string) =>
    `relative z-10 flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
      active === name ? "text-accent" : "text-muted"
    }`;
  // The outline drawing fills in while its tab is the one you're on.
  const icon = (name: string, children: ReactNode) => (
    <svg
      key={tapped?.tab === name ? tapped.count : 0}
      viewBox="0 0 24 24"
      fill={active === name ? "currentColor" : "none"}
      fillOpacity={0.18}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`size-6 ${tapped?.tab === name ? "motion-safe:animate-tap" : ""}`}
    >
      {children}
    </svg>
  );

  return (
    <nav
      aria-label="Phone menu"
      // Its own name for page transitions, so it stays put while the page slides.
      style={{ viewTransitionName: "tab-bar" }}
      className={`glass-bar fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 grid grid-cols-5 items-center rounded-[1.75rem] px-2 py-1.5 transition-transform duration-300 motion-reduce:transition-none md:hidden ${
        hidden ? "translate-y-[calc(100%+2rem)]" : ""
      }`}
    >
      {/* The pill behind the active tab; it glides from tab to tab. */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-1.5 left-2 w-[calc((100%-1rem)/5)] rounded-2xl bg-accent/10 transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${
          active ? "opacity-100" : "opacity-0"
        }`}
        style={{ transform: `translateX(${(active ? SLOT[active as keyof typeof SLOT] : 0) * 100}%)` }}
      />
      <button onClick={() => tap("home", () => onSelectList("home"))} aria-label="Home" aria-pressed={active === "home"} className={tab("home")}>
        {icon("home", <path d="M4 11l8-7 8 7v9H4Z M10 20v-5h4v5" />)}
        Home
      </button>
      <button
        onClick={() => tap("folders", onOpenFolders)}
        ref={foldersButton}
        aria-label="Folders"
        aria-expanded={foldersOpen}
        aria-controls="sidebar"
        className={tab("folders")}
      >
        {icon("folders", <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />)}
        Folders
      </button>
      <button
        onClick={onSave}
        aria-label="Save a link"
        className="relative z-10 mx-auto grid size-14 -translate-y-3 place-items-center rounded-full bg-[#0071e3] text-white shadow-lg shadow-black/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true" className="size-7">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button onClick={() => tap("unread", () => onSelectList("unread"))} aria-label="Unread" aria-pressed={active === "unread"} className={tab("unread")}>
        {icon("unread", <path d="M5 4h14v17l-7-4-7 4Z" />)}
        Unread
      </button>
      <NextLink href={accountHref} className={tab("you")}>
        {icon(
          "you",
          <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
          </>
        )}
        {accountLabel}
      </NextLink>
    </nav>
  );
}
