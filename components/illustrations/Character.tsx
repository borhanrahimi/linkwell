// Linkwell's character, drawn after the person who built Linkwell: curly black
// hair, square black glasses, a moustache, stubble, a friendly smile and a
// black T-shirt. Every illustration puts these same parts together, so the
// character always looks like the same person.
//
// The style (see docs/ROADMAP.md, v1.6): black-and-white line art. Ink lines
// are currentColor, solid shapes are fill-ink, and fill-surface paints white
// where shapes overlap. Both swap in dark mode.
//
// Parts are placed with x/y: for Head and Tee, that's the middle of the face.

type At = { x: number; y: number };

// Short stubble along the jaw and chin.
const STUBBLE: [number, number][] = [
  [-11, 9], [-10.4, 12], [-8.6, 14.8], [-6, 16.8], [-2.6, 17.8], [1, 18], [4.4, 17.4],
  [7.4, 15.6], [9.6, 13], [10.8, 10], [-3.6, 15.2], [0, 15.8], [3.6, 15.2],
];

export function Head({ x, y }: At) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* ears, then the face */}
      <path d="M-13.6-1c-3.6-1.2-5.6 1.8-4.6 4.6.8 2.4 3 3.4 4.8 2.6" className="fill-surface" />
      <path d="M13.6-1c3.6-1.2 5.6 1.8 4.6 4.6-.8 2.4-3 3.4-4.8 2.6" className="fill-surface" />
      <path d="M-14-5c0-10 6-16 14-16s14 6 14 16v10c0 10-6 16-14 16S-14 15-14 5Z" className="fill-surface" />

      {/* curly black hair: a row of round curls, with a few white curl lines */}
      <path
        d="M-14.2-1.6a4 4 0 0 1-2.6-6 4.4 4.4 0 0 1 2-6.8 4.8 4.8 0 0 1 5.6-5.4 5 5 0 0 1 8-2.6 5 5 0 0 1 8 1.4 4.8 4.8 0 0 1 5.4 5 4.4 4.4 0 0 1 2.4 6.6 4 4 0 0 1-1.4 5.8c-.6-3.4-2-5.6-4.2-6.8-2.4 1.4-5.6 1.4-8.4-.4-3 1.8-7 2.2-10.4.8-2.4 1.4-3.8 3.6-4.4 6.4Z"
        className="fill-ink"
      />
      <path d="M-8.6-15.4c1.4-1.2 3.4-1 4.4.4M1.4-17.6c1.6-.8 3.4-.2 4 1.2M-13-8.8c.4-1.6 2-2.4 3.4-1.8M9.6-12c1.4-.2 2.6.8 2.6 2.2" strokeWidth={1.2} className="stroke-surface" />

      {/* eyebrows */}
      <path d="M-10-6.6c2-1 4.6-1.2 6.6-.4M3.4-7c2-.8 4.6-.6 6.6.4" strokeWidth={2.2} />
      {/* eyes, behind square black glasses */}
      <circle cx={-6} cy={0.4} r={1.4} stroke="none" className="fill-ink" />
      <circle cx={6} cy={0.4} r={1.4} stroke="none" className="fill-ink" />
      <path d="M-11.2-4h9.4v8.2h-9.4ZM1.8-4h9.4v8.2H1.8ZM-1.8-1.6c1.2-.8 2.4-.8 3.6 0M-11.2-3l-2.6-.6M11.2-3l2.6-.6" strokeWidth={2.4} />

      {/* nose, moustache, smile and stubble */}
      <path d="M.2 3.6c-.2 2.4-1 4-2.2 5 1 .6 2.4.6 3.4 0" strokeWidth={1.6} />
      <path d="M-7.2 11.2c2-2.4 4.8-3 7.2-1.4 2.4-1.6 5.2-1 7.2 1.4-2.4.4-5-.2-7.2-.4-2.2.2-4.8.8-7.2.4Z" className="fill-ink" />
      <path d="M-5.4 13c3.2 2.4 7.6 2.4 10.8 0" />
      {STUBBLE.map(([sx, sy]) => (
        <circle key={`${sx},${sy}`} cx={sx} cy={sy} r={0.45} stroke="none" className="fill-ink" />
      ))}
    </g>
  );
}

// Neck, shoulders and a black crew-neck T-shirt, cropped by the drawing's edge.
export function Tee({ x, y }: At) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-5 18v10h10V18" className="fill-surface" />
      <path d="M-34 94V64c0-22 10-34 29-38 3 4 7 4 10 0 19 4 29 16 29 38v30Z" className="fill-ink" />
      {/* the collar's seam */}
      <path d="M-7.4 28.2c3.6 4.6 11.2 4.6 14.8 0" strokeWidth={1.2} className="stroke-surface" />
    </g>
  );
}

// An arm as one bent line: a thick ink line with a thinner white line on top,
// so it looks outlined. Draw it before the Tee to have it come out from behind
// the shoulder.
export function Arm({ d }: { d: string }) {
  return (
    <>
      <path d={d} strokeWidth={12} />
      <path d={d} strokeWidth={8} className="stroke-surface" />
    </>
  );
}

// A closed hand, gripping something.
export function Fist({ x, y }: At) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-5.6 2.6c-1.2-4.4 1.6-8.4 6-8.6 4.2-.2 6.8 3 6 6.6-.8 3.4-4 5.2-7.4 4.6Z" className="fill-surface" />
      <path d="M-2.2-5.4c1.4.8 2.2 2.4 2 4M1.4-5.8c1.2 1 1.8 2.6 1.4 4.2" strokeWidth={1.6} />
    </g>
  );
}

// An open hand, fingers up, for waving. turn tilts it (degrees).
export function Palm({ x, y, turn = 0 }: At & { turn?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn}) scale(1.4)`} strokeWidth={1.5}>
      <path d="M-5 6c-.8-4-.8-9 .2-12.4.8-2.8 3.4-3.8 5.6-3.6 2.4.2 4.4 1.8 4.8 4.6.4 3.4.2 7.6-.6 11.4Z" className="fill-surface" />
      <path d="M-5 1.6C-8 .8-10 -1.6-9.6-3.6c.4-1.4 2-1.4 3 0l1.6 2.4" className="fill-surface" />
      <path d="M-1.4-9.6v5M1.6-9.8v5" strokeWidth={1.1} />
    </g>
  );
}

// A four-pointed twinkle, outlined.
export function Sparkle({ x, y, size = 1 }: At & { size?: number }) {
  return (
    <path
      d="M0-5c.4 3 1.2 4.4 5 5-3.8.6-4.6 2-5 5-.4-3-1.2-4.4-5-5 3.8-.6 4.6-2 5-5Z"
      transform={`translate(${x} ${y}) scale(${size})`}
      strokeWidth={1.8 / size}
      className="fill-surface"
    />
  );
}

// A bookmark ribbon, outlined, centred on x/y.
export function Bookmark({ x, y, turn = 0 }: At & { turn?: number }) {
  return <path d="M-5-7h10v14l-5-3.6-5 3.6Z" transform={`translate(${x} ${y}) rotate(${turn})`} className="fill-surface" />;
}

// Every illustration shares the same <svg> settings.
export function Drawing({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`text-ink ${className}`}
    >
      {children}
    </svg>
  );
}
