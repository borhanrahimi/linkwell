"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { SmartList } from "@/lib/links";

export type Tab = "home" | "folders" | "unread" | "you";

type BottomBarProps = {
  // The tab you're on, if any (a folder counts as Folders).
  active: Tab | null;
  // In the app, tabs switch in place and + opens the save sheet. Left out
  // (the account page), the tabs are plain links back into the app.
  onSelectList?: (list: SmartList) => void;
  onSave?: () => void;
  // Where "You" goes: the account page, or (in the demo) signing in.
  accountHref: string;
  accountLabel: string;
};

// Where the sliding highlight sits for each tab (the + is in the middle).
const SLOT: Record<Tab, number> = { home: 0, folders: 1, unread: 3, you: 4 };
// What's in each of the five places, left to right.
const SLOTS = ["home", "folders", "save", "unread", "you"] as const;
type Slot = (typeof SLOTS)[number];
// How far a finger moves before a press becomes a drag (in pixels).
const DRAG_START = 8;

// The addresses of the tabs, for pages outside the app (the account page).
const HREF = { home: "/", folders: "/?list=folders", unread: "/?list=unread", save: "/?save=1" } as const;

// Phones only: the main places within thumb's reach, like most phone apps.
// Home, Folders, a big + to save a link, Unread, and You. It's on every
// signed-in page, so you can always get back. A floating bar of frosted glass
// (glass-bar: the page blurs behind it), lifted off the bottom edge and clear
// of the iPhone's home line. A soft pill glides to the tab you tap; the bar
// slides away while you scroll down to read and comes back when you scroll
// up. Like Instagram's, you can also press and slide along it: the pill
// follows your finger, and letting go opens the tab under it (the + opens the
// save box). Wider screens have the sidebar and the top bar instead.
export default function BottomBar({ active, onSelectList, onSave, accountHref, accountLabel }: BottomBarProps) {
  const [hidden, setHidden] = useState(false);
  // The tab that was just tapped bounces; a new number starts it again.
  const [tapped, setTapped] = useState<{ tab: Tab; count: number } | null>(null);
  const router = useRouter();
  const bar = useRef<HTMLElement>(null);
  // While a finger slides along the bar: where the pill is (pixels from the
  // left) and which place it's over. null when nobody is dragging.
  const [drag, setDrag] = useState<{ x: number; slot: number } | null>(null);
  const press = useRef<{ id: number; startX: number; dragging: boolean; slot: number } | null>(null);
  // A drag ends with a click on whatever was pressed; that click is ignored.
  const ignoreClick = useRef(false);

  // The place under a finger, and where the pill goes (centred on it).
  function measure(clientX: number) {
    const box = bar.current!.getBoundingClientRect();
    const inner = box.width - 16; // the bar's px-2 padding, both sides
    const width = inner / SLOTS.length;
    const x = Math.min(Math.max(clientX - box.left - 8 - width / 2, 0), inner - width);
    return { x, slot: Math.min(SLOTS.length - 1, Math.max(0, Math.floor((clientX - box.left - 8) / width))) };
  }

  function go(slot: Slot) {
    if (slot === "save") {
      if (onSave) onSave();
      else router.push(HREF.save);
    } else if (slot === "you") {
      router.push(accountHref);
    } else if (onSelectList) {
      setTapped((current) => ({ tab: slot, count: (current?.count ?? 0) + 1 }));
      onSelectList(slot);
    } else {
      router.push(HREF[slot]);
    }
  }

  function onPointerDown(event: React.PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    press.current = { id: event.pointerId, startX: event.clientX, dragging: false, slot: measure(event.clientX).slot };
  }

  function onPointerMove(event: React.PointerEvent) {
    const current = press.current;
    if (!current || current.id !== event.pointerId) return;
    if (!current.dragging && Math.abs(event.clientX - current.startX) < DRAG_START) return;
    if (!current.dragging) {
      current.dragging = true;
      // Keep getting the finger's moves even when it leaves the button it pressed.
      bar.current?.setPointerCapture(event.pointerId);
    }
    const next = measure(event.clientX);
    // A tiny buzz each time the pill reaches another place, where phones can.
    if (next.slot !== current.slot) navigator.vibrate?.(8);
    current.slot = next.slot;
    setDrag(next);
  }

  function onPointerUp(event: React.PointerEvent) {
    const current = press.current;
    press.current = null;
    if (!current?.dragging || current.id !== event.pointerId) return;
    ignoreClick.current = true;
    setDrag(null);
    // Let go above the bar (slid off it): nothing happens.
    const box = bar.current!.getBoundingClientRect();
    if (event.clientY < box.top - 24) return;
    go(SLOTS[current.slot]);
  }

  function onPointerCancel() {
    press.current = null;
    setDrag(null);
  }

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

  // True (and the click cancelled) when this click only ends a drag.
  function skipAfterDrag(event: React.MouseEvent) {
    if (!ignoreClick.current) return false;
    ignoreClick.current = false;
    event.preventDefault();
    return true;
  }

  // While dragging, the place under the finger looks chosen instead.
  const shown: Slot | null = drag ? SLOTS[drag.slot] : active;
  const tabClass = (name: Tab) =>
    `relative z-10 flex select-none flex-col items-center gap-0.5 rounded-2xl py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 [-webkit-touch-callout:none] ${
      shown === name ? "text-ink" : "text-muted"
    }`;
  // The outline drawing fills in, in the accent blue, while its tab is the one
  // you're on. The label stays ink: blue text on the blue pill is too faint.
  const icon = (name: Tab, children: ReactNode) => (
    <svg
      key={tapped?.tab === name ? tapped.count : 0}
      viewBox="0 0 24 24"
      fill={shown === name ? "currentColor" : "none"}
      fillOpacity={0.18}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`size-6 ${shown === name ? "text-accent" : ""} ${tapped?.tab === name ? "motion-safe:animate-tap" : ""}`}
    >
      {children}
    </svg>
  );

  // In the app a tab is a button that switches in place; elsewhere a link.
  function tab(name: Exclude<Tab, "you">, label: string, drawing: ReactNode) {
    const content = (
      <>
        {icon(name, drawing)}
        {label}
      </>
    );
    if (!onSelectList) {
      return (
        <NextLink href={HREF[name]} onClick={skipAfterDrag} aria-current={active === name ? "page" : undefined} className={tabClass(name)}>
          {content}
        </NextLink>
      );
    }
    return (
      <button
        onClick={(event) => {
          if (skipAfterDrag(event)) return;
          go(name);
        }}
        aria-pressed={active === name}
        className={tabClass(name)}
      >
        {content}
      </button>
    );
  }

  const plus = `relative z-10 mx-auto grid size-14 -translate-y-3 place-items-center rounded-full bg-[#0071e3] text-white shadow-lg shadow-black/20 transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 [-webkit-touch-callout:none] ${
    shown === "save" ? "motion-safe:scale-110" : ""
  }`;
  const plusIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true" className="size-7">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );

  return (
    <nav
      ref={bar}
      aria-label="Phone menu"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      // Its own name for page transitions, so it stays put while the page slides.
      style={{ viewTransitionName: "tab-bar" }}
      // touch-none: a finger sliding on the bar moves the pill, not the page.
      className={`glass-bar fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 grid touch-none grid-cols-5 items-center rounded-[1.75rem] px-2 py-1.5 transition-transform duration-300 motion-reduce:transition-none md:hidden ${
        hidden && !drag ? "translate-y-[calc(100%+2rem)]" : ""
      }`}
    >
      {/* The pill behind the active tab; it glides from tab to tab. */}
      {/* While dragging it follows the finger (no easing), a little bigger. */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-1.5 left-2 w-[calc((100%-1rem)/5)] rounded-2xl ${
          drag ? "bg-accent/15 shadow-md motion-safe:scale-110" : "bg-accent/10 transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none"
        } ${drag || active ? "opacity-100" : "opacity-0"}`}
        style={{ transform: drag ? `translateX(${drag.x}px)` : `translateX(${(active ? SLOT[active] : 0) * 100}%)` }}
      />
      {tab("home", "Home", <path d="M4 11l8-7 8 7v9H4Z M10 20v-5h4v5" />)}
      {tab("folders", "Folders", <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />)}
      {onSave ? (
        <button
          onClick={(event) => {
            if (!skipAfterDrag(event)) onSave();
          }}
          aria-label="Save a link"
          className={plus}
        >
          {plusIcon}
        </button>
      ) : (
        <NextLink href={HREF.save} onClick={skipAfterDrag} aria-label="Save a link" className={plus}>
          {plusIcon}
        </NextLink>
      )}
      {tab("unread", "Unread", <path d="M5 4h14v17l-7-4-7 4Z" />)}
      <NextLink href={accountHref} onClick={skipAfterDrag} aria-current={active === "you" ? "page" : undefined} className={tabClass("you")}>
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
