"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useSwipeToClose } from "@/components/useSwipeToClose";

type SheetProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  // Buttons at the bottom (like Cancel and Add), kept in view while the
  // rest scrolls.
  footer?: ReactNode;
  // false: the content focuses something itself (like the save box's link field).
  focusTitle?: boolean;
};

// A window over the page: a sheet that slides up from the bottom on phones
// (with a handle to swipe it down), a centred dialog on wider screens.
// Focus moves to its title, Esc closes it, and the page behind stops
// scrolling while it's open. The opener puts focus back when it closes.
export default function Sheet({ title, onClose, children, footer, focusTitle = true }: SheetProps) {
  const { sheet: panel, handle } = useSwipeToClose<HTMLDivElement>(onClose);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusTitle) heading.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = overflow;
    };
  }, [onClose, focusTitle]);

  return (
    <>
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-40 bg-black/40 motion-safe:animate-fade-in" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-3xl bg-surface shadow-2xl max-md:motion-safe:animate-sheet-up md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[80vh] md:w-[34rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:motion-safe:animate-fade-in"
      >
        {/* The handle: phones only. */}
        <div aria-hidden="true" {...handle} className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-3 md:hidden">
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-2 md:pt-5">
          <h2 id="sheet-title" ref={heading} tabIndex={-1} className="text-lg font-semibold text-ink focus:outline-none">
            {title}
          </h2>
          <button onClick={onClose} className="btn-quiet">
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
