import { useRef } from "react";

// Swiping a sheet's handle down follows the finger; let go far enough down
// (80px) and the sheet closes, otherwise it springs back. Pointer events
// cover touch, pen and mouse. Spread `handle` on the handle, `sheet` is the
// ref for the part that moves.
export function useSwipeToClose<T extends HTMLElement>(onClose: () => void) {
  const sheet = useRef<T>(null);
  const start = useRef<number | null>(null);

  function release(y: number) {
    if (start.current === null || !sheet.current) return;
    const distance = y - start.current;
    start.current = null;
    sheet.current.style.transform = "";
    if (distance > 80) onClose();
  }

  const handle = {
    onPointerDown(event: React.PointerEvent<HTMLElement>) {
      start.current = event.clientY;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: React.PointerEvent<HTMLElement>) {
      if (start.current === null || !sheet.current) return;
      sheet.current.style.transform = `translateY(${Math.max(0, event.clientY - start.current)}px)`;
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => release(event.clientY),
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => release(event.clientY),
  };

  return { sheet, handle };
}
