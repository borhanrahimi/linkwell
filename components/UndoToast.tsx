"use client";

import { useEffect, useRef, useState } from "react";

// How long the message stays, unless a mouse is over it or it has focus.
export const UNDO_SECONDS = 6;

export type Toast = {
  // A new id means a new message: its timer starts again.
  id: number;
  message: string;
  // Without one, the message just says what happened (like an error).
  onUndo?: () => void;
};

type UndoToastProps = {
  toast: Toast | null;
  onClose: () => void;
};

// The small message after a change, with Undo: "3 links moved to Reading
// [Undo]". One at a time: the next change replaces it, and its Undo goes with
// it. Screen readers hear it (role="status"), and it waits while a mouse is
// over it or the keyboard is on its button, so nobody has to hurry.
export default function UndoToast({ toast, onClose }: UndoToastProps) {
  // Which message is waiting, so a new one never starts out paused.
  const [pausedFor, setPausedFor] = useState<number | null>(null);
  const paused = toast !== null && pausedFor === toast.id;
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast || paused) return;
    const timer = setTimeout(onClose, UNDO_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [toast, paused, onClose]);

  return (
    // The live region stays on the page, so a new message is always announced.
    <div
      role="status"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center md:bottom-6"
    >
      {toast && (
        <div
          key={toast.id}
          ref={box}
          onMouseEnter={() => setPausedFor(toast.id)}
          onMouseLeave={() => setPausedFor(null)}
          onFocus={() => setPausedFor(toast.id)}
          onBlur={(event) => {
            if (!box.current?.contains(event.relatedTarget as Node | null)) setPausedFor(null);
          }}
          className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full bg-ink py-1.5 pl-5 pr-1.5 text-sm text-canvas shadow-lg motion-safe:animate-rise-in"
        >
          <span className="min-w-0 py-1.5">{toast.message}</span>
          {toast.onUndo && (
            <button
              onClick={() => {
                toast.onUndo?.();
                onClose();
              }}
              className="shrink-0 rounded-full px-3 py-1.5 font-semibold text-canvas underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Undo
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close message"
            className="grid size-8 shrink-0 place-items-center rounded-full text-canvas/70 hover:text-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="size-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
