"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// Picking links and folders up and putting them where they belong.
//
// Pointer events, so one code path works for a mouse, a finger and a pen. A
// mouse picks something up once it moves a little with the button down. A
// finger has to press and hold first (with a small buzz where phones can),
// because a finger that moves at once is scrolling the page. While something
// is picked up, the page scrolls when it comes near the top or bottom edge,
// Esc puts it back, and screen readers hear what's happening.
//
// Anything with data-drop-folder="<id>" takes a drop. With data-drop-reorder
// as well (the sidebar's rows, in My order), a folder dropped near the row's
// top or bottom edge goes before or after it instead of inside it.

export type DragItem =
  | { kind: "links"; ids: string[]; name: string }
  | { kind: "folder"; id: string; name: string };

export type DropSpot = { folderId: string; where: "into" | "before" | "after" };

// How far a mouse moves before a press becomes a drag, how long a finger
// holds before it picks something up, and how far it may wobble meanwhile.
const MOUSE_START = 6;
const HOLD_MS = 400;
const HOLD_WOBBLE = 8;
// Near the top or bottom edge (in pixels), the page scrolls.
const EDGE = 64;
// The part of a row, top and bottom, that means "before" and "after".
const REORDER_EDGE = 0.3;

// On drag sources: no picture callout on a long press (iPhones), and no text
// selection where a finger holds (touch screens).
export const DRAG_SOURCE_CLASS = "[-webkit-touch-callout:none] [@media(hover:none)]:select-none";

type SourceProps = {
  onPointerDown: (event: React.PointerEvent) => void;
  onDragStart: (event: React.DragEvent) => void;
  onContextMenu: (event: React.MouseEvent) => void;
};

type DragContextValue = {
  // What's picked up, and where it would land now.
  item: DragItem | null;
  over: DropSpot | null;
  // Spread on anything that can be picked up.
  dragSource: (getItem: () => DragItem) => SourceProps | Record<string, never>;
  // Says something to screen readers.
  announce: (message: string) => void;
};

// Without a provider (a component on its own in a test), nothing can be dragged.
const DragContext = createContext<DragContextValue>({
  item: null,
  over: null,
  dragSource: () => ({}),
  announce: () => {},
});

export function useDrag() {
  return useContext(DragContext);
}

type DragProviderProps = {
  // Whether the item may land there; places it may not show nothing.
  canDrop: (item: DragItem, spot: DropSpot) => boolean;
  onDrop: (item: DragItem, spot: DropSpot) => void;
  folderName: (id: string) => string;
  children: ReactNode;
};

type Press = {
  pointerId: number;
  touch: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
  getItem: () => DragItem;
  timer?: ReturnType<typeof setTimeout>;
};

// Where the ghost goes for a pointer there: beside a mouse pointer, and
// above a finger, which would hide it (and the folders under it) otherwise.
function ghostAt(x: number, y: number, touch: boolean) {
  return touch ? `translate(${x - 40}px, ${y - 64}px)` : `translate(${x + 14}px, ${y + 14}px)`;
}

function sameSpot(a: DropSpot | null, b: DropSpot | null) {
  return a?.folderId === b?.folderId && a?.where === b?.where;
}

export function DragProvider({ canDrop, onDrop, folderName, children }: DragProviderProps) {
  const [item, setItem] = useState<DragItem | null>(null);
  const [over, setOver] = useState<DropSpot | null>(null);
  // Where the ghost first shows; after that it follows the pointer by itself.
  const [startAt, setStartAt] = useState({ x: 0, y: 0, touch: false });
  const [message, setMessage] = useState("");
  // The same, for the event listeners (they'd see old state otherwise).
  const press = useRef<Press | null>(null);
  const picked = useRef<DragItem | null>(null);
  const overRef = useRef<DropSpot | null>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const scrolling = useRef<number | null>(null);
  const latest = useRef({ canDrop, onDrop, folderName });
  useEffect(() => {
    latest.current = { canDrop, onDrop, folderName };
  });

  const announce = useCallback((text: string) => setMessage(text), []);

  // The folder under the pointer, and which part of it.
  const spotAt = useCallback((x: number, y: number): DropSpot | null => {
    const dragged = picked.current;
    const target = document.elementFromPoint?.(x, y)?.closest<HTMLElement>("[data-drop-folder]");
    if (!dragged || !target) return null;
    const folderId = target.dataset.dropFolder!;
    let where: DropSpot["where"] = "into";
    if (dragged.kind === "folder" && target.dataset.dropReorder !== undefined) {
      const box = target.getBoundingClientRect();
      if (y < box.top + box.height * REORDER_EDGE) where = "before";
      else if (y > box.bottom - box.height * REORDER_EDGE) where = "after";
    }
    const spot = { folderId, where };
    return latest.current.canDrop(dragged, spot) ? spot : null;
  }, []);

  const moveTo = useCallback(
    (x: number, y: number) => {
      if (press.current) {
        press.current.x = x;
        press.current.y = y;
      }
      // The ghost follows the pointer without React drawing the page again.
      if (ghost.current) ghost.current.style.transform = ghostAt(x, y, press.current?.touch ?? false);
      const spot = spotAt(x, y);
      if (sameSpot(spot, overRef.current)) return;
      overRef.current = spot;
      setOver(spot);
      if (spot) {
        const name = latest.current.folderName(spot.folderId);
        setMessage(spot.where === "into" ? `Over ${name}` : `${spot.where === "before" ? "Before" : "After"} ${name}`);
      }
    },
    [spotAt]
  );

  // Ends a drag (or a press that never became one) and tidies up.
  const finish = useCallback((drop: boolean) => {
    const dragged = picked.current;
    const spot = overRef.current;
    clearTimeout(press.current?.timer);
    press.current = null;
    picked.current = null;
    overRef.current = null;
    if (scrolling.current !== null) cancelAnimationFrame(scrolling.current);
    scrolling.current = null;
    document.documentElement.classList.remove("dragging");
    setItem(null);
    setOver(null);
    if (!dragged) return;
    // The press ends with a click on what was picked up: that click is
    // ignored. It comes right after this, or not at all (let go somewhere
    // else), so the next click after that is a real one again.
    const swallow = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
    if (drop && spot) {
      const name = latest.current.folderName(spot.folderId);
      setMessage(spot.where === "into" ? `Dropped into ${name}` : `Dropped ${spot.where} ${name}`);
      latest.current.onDrop(dragged, spot);
    } else {
      setMessage(`${dragged.name} put back`);
    }
  }, []);

  const pickUp = useCallback(() => {
    const current = press.current;
    if (!current) return;
    const dragged = current.getItem();
    picked.current = dragged;
    setItem(dragged);
    setStartAt({ x: current.x, y: current.y, touch: current.touch });
    if (current.touch) navigator.vibrate?.(10);
    window.getSelection?.()?.removeAllRanges();
    document.documentElement.classList.add("dragging");
    setMessage(`Picked up ${dragged.name}. Drop it on a folder, or press Escape to put it back.`);
    // Near the top or bottom of the window, the page scrolls, faster nearer
    // the edge, every frame until the drag ends.
    function scrollNearEdges() {
      const now = press.current;
      if (!now || !picked.current) return;
      const { y } = now;
      const speed = y < EDGE ? -(EDGE - y) / 4 : y > window.innerHeight - EDGE ? (y - (window.innerHeight - EDGE)) / 4 : 0;
      if (speed) {
        window.scrollBy(0, speed);
        moveTo(now.x, now.y);
      }
      scrolling.current = requestAnimationFrame(scrollNearEdges);
    }
    scrolling.current = requestAnimationFrame(scrollNearEdges);
  }, [moveTo]);

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const current = press.current;
      if (!current || event.pointerId !== current.pointerId) return;
      if (picked.current) {
        moveTo(event.clientX, event.clientY);
        return;
      }
      const moved = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
      current.x = event.clientX;
      current.y = event.clientY;
      if (current.touch) {
        // Moving before the hold is up: it's a scroll, not a drag.
        if (moved > HOLD_WOBBLE) finish(false);
      } else if (moved > MOUSE_START) {
        pickUp();
      }
    }
    function onUp(event: PointerEvent) {
      if (press.current && event.pointerId === press.current.pointerId) finish(true);
    }
    function onCancel(event: PointerEvent) {
      if (press.current && event.pointerId === press.current.pointerId) finish(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && picked.current) {
        event.preventDefault();
        finish(false);
      }
    }
    // While a finger holds something, it mustn't scroll the page. This has to
    // be a listener that isn't passive, so it may cancel the scroll.
    function onTouchMove(event: TouchEvent) {
      if (picked.current) event.preventDefault();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [finish, moveTo, pickUp]);

  const dragSource = useCallback(
    (getItem: () => DragItem): SourceProps => ({
      onPointerDown(event) {
        if (press.current || (event.pointerType === "mouse" && event.button !== 0)) return;
        // The source's own buttons and fields do their own thing; a folder
        // row is a button itself, and that's fine. A card's title (a link) is
        // where people grab it, so it can start a drag too: a click on it
        // still opens the page, and the click a drag ends with is ignored.
        const control = (event.target as Element).closest("button, input, select, textarea, label");
        if (control && control !== event.currentTarget) return;
        const touch = event.pointerType !== "mouse";
        press.current = {
          pointerId: event.pointerId,
          touch,
          startX: event.clientX,
          startY: event.clientY,
          x: event.clientX,
          y: event.clientY,
          getItem,
        };
        if (touch) press.current.timer = setTimeout(pickUp, HOLD_MS);
      },
      // The browser's own dragging (of pictures and links) would take over.
      onDragStart(event) {
        event.preventDefault();
      },
      // A long press would open the phone's menu instead.
      onContextMenu(event) {
        if (press.current?.touch || picked.current) event.preventDefault();
      },
    }),
    [pickUp]
  );

  return (
    <DragContext value={{ item, over, dragSource, announce }}>
      {children}
      {item && (
        <div
          ref={ghost}
          aria-hidden="true"
          className="glass-bar pointer-events-none fixed left-0 top-0 z-50 max-w-60 truncate rounded-full px-4 py-2 text-sm font-medium text-ink shadow-lg"
          style={{ transform: ghostAt(startAt.x, startAt.y, startAt.touch) }}
        >
          {item.kind === "links" && item.ids.length > 1 ? `Moving ${item.ids.length} links` : item.name}
        </div>
      )}
      <p aria-live="assertive" className="sr-only">
        {message}
      </p>
    </DragContext>
  );
}
