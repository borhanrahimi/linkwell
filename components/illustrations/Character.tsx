import { useId, type ReactNode } from "react";

// Linkwell's character, drawn after the person who built Linkwell: curly black
// hair, square glasses, a moustache, stubble and a dark T-shirt.
//
// The style (see docs/ROADMAP.md, v1.9): loose pen doodles, like sketches in a
// notebook. Thin ink lines with a little hand wobble (the "pen" filter in
// Drawing), stick arms and legs, grey marker shading that doesn't quite stay
// inside the lines, and a soft shadow under the feet. Ink lines are
// currentColor, fill-surface paints the paper where shapes overlap, and
// fill-marker / fill-marker-strong are the marker greys. All swap in dark mode.

type At = { x: number; y: number };

// Every illustration shares the same <svg>: the size, the pen and its wobble.
// The wobble is an SVG filter that nudges each line by a pixel or two, so
// straight lines look drawn by hand. Each drawing gets its own filter id.
export function Drawing({ className = "", children }: { className?: string; children: ReactNode }) {
  const pen = `pen-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`text-ink ${className}`}
    >
      <defs>
        <filter id={pen} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={4} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={2.6} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${pen})`}>{children}</g>
    </svg>
  );
}

// A shape with marker shading: paper underneath (hiding what's behind), then
// the grey, shifted a little like a quick marker stroke, then the pen outline.
export function Shaded({ d, strong = false, transform }: { d: string; strong?: boolean; transform?: string }) {
  return (
    <g transform={transform}>
      <path d={d} stroke="none" className="fill-surface" />
      <path d={d} stroke="none" transform="translate(1.6 1.4)" className={strong ? "fill-marker-strong" : "fill-marker"} />
      <path d={d} />
    </g>
  );
}

// The soft grey shadow on the ground under someone's feet (x/y: its middle).
export function Shadow({ x, y, width = 18 }: At & { width?: number }) {
  return <ellipse cx={x} cy={y} rx={width / 2} ry={2.4} stroke="none" className="fill-marker" />;
}

// The face, x/y its middle. tilt turns the head a little (degrees).
export function Head({ x, y, tilt = 0 }: At & { tilt?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      {/* ears and face */}
      <path d="M-9.4-.4c-2.6-.8-3.6 2.6-1.4 3.8M9.4-.4c2.6-.8 3.6 2.6 1.4 3.8" />
      <path d="M.2-10.4c6 0 9.6 4.4 9.4 10S5.6 10.8-.2 10.6-9.6 6-9.4.2-5.6-10.4.2-10.4Z" className="fill-surface" />

      {/* curly black hair: a bumpy cap, with a few curl loops on top */}
      <path
        d="M-9.4-1.6c-2.2-2.6-1.6-6.6 1-7.6-.6-3.2 2.4-5.8 5.4-4.6 1-2.6 5-3 6.6-.8 2.4-1.4 5.8.2 5.8 3 2.6 1 3.2 4.6 1.2 6.6l-.6 3.4c-.6-2.6-1.6-4-3.4-5-2.6 1.4-6.2 1.6-9.2.4-2.6.8-4.4 2.4-6.8 4.6Z"
        className="fill-ink"
      />
      <path d="M-6.6-11c-1.6-2.4 1.6-4.4 2.6-1.8M1.4-14.2c-.6-2.6 3-3.2 3.2-.6M8.6-10.8c1.4-2 4-.2 2.6 1.8" strokeWidth={1.3} />

      {/* square glasses, the eyes behind them, eyebrows */}
      <path d="M-7.6-2.6h5.8v5h-5.8ZM1.8-2.6h5.8v5H1.8ZM-1.8-1.4c1.2-.6 2.4-.6 3.6 0M-7.6-1.6l-2-.4M7.6-1.6l2-.4" strokeWidth={1.4} />
      <circle cx={-4.6} cy={-0.1} r={1} stroke="none" className="fill-ink" />
      <circle cx={4.8} cy={-0.1} r={1} stroke="none" className="fill-ink" />
      <path d="M-7-4.6c1.4-.8 3.4-.8 4.8 0M2.2-4.6c1.4-.8 3.4-.8 4.8 0" strokeWidth={1.3} />

      {/* moustache, smile, a few dots of stubble */}
      <path d="M-3.8 5.4c1.4-1.4 2.8-1.4 3.8-.4 1-1 2.4-1 3.8.4-1.4.6-2.6.4-3.8 0-1.2.4-2.4.6-3.8 0Z" className="fill-ink" />
      <path d="M-2.8 7.6c1.8 1.2 3.8 1.2 5.6 0" strokeWidth={1.3} />
      <path d="M-6.6 6.4h.01M-5.2 8.6h.01M5.6 6.6h.01M4.4 8.8h.01M0 9.6h.01" strokeWidth={1.2} />
    </g>
  );
}

// The T-shirt, from the neck (x/y) down to the hips 30 below, with short
// sleeves; a short neck joins it to the head above. Arms start at a sleeve's
// end, about (±15, 10) from x/y.
export function Tee({ x, y }: At) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-2.6-2.4v3M2.6-2.4v3" strokeWidth={1.5} />
      <Shaded
        strong
        d="M-4 0C-8 .2-11 1.2-13 3l-3.4 7 5 2.4-.4 18.2h20.6l-.4-18.2 5-2.4L13 3C11 1.2 8 .2 4 0 2.4 2.4-2.4 2.4-4 0Z"
      />
    </g>
  );
}

// A stick limb (an arm or a leg): just a pen line.
export function Limb({ d }: { d: string }) {
  return <path d={d} strokeWidth={1.8} />;
}

// A hand: a small round mitten at the end of an arm.
export function Hand({ x, y }: At) {
  return <circle cx={x} cy={y} r={2.4} className="fill-surface" strokeWidth={1.5} />;
}

// A shoe at the end of a leg; facing -1 points it left.
export function Shoe({ x, y, facing = 1 }: At & { facing?: 1 | -1 }) {
  return (
    <path
      d="M-1.4-1.6h4.8c2.6 0 3.4 3 .6 3.2h-5.8c-1.2 0-1.2-3.2.4-3.2Z"
      transform={`translate(${x} ${y}) scale(${facing} 1)`}
      stroke="none"
      className="fill-ink"
    />
  );
}

// Standing legs from the hips (x/y is the T-shirt's neck) to the ground, with
// shoes and the shadow. spread moves the feet apart.
export function Legs({ x, y, spread = 3 }: At & { spread?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <Shadow x={0} y={57.4} width={24 + spread * 2} />
      <Limb d={`M-4.4 30.4l${-spread} 25.4M4.4 30.4l${spread} 25.4`} />
      <Shoe x={-4.4 - spread - 1} y={56} facing={-1} />
      <Shoe x={4.4 + spread + 1} y={56} />
    </g>
  );
}

// A speech bubble: a wobbly oval with a little tail pointing to (tailX, tailY).
// What it says goes in children, drawn around the bubble's middle (x/y).
export function Bubble({ x, y, w = 24, h = 18, tailX, tailY, children }: At & {
  w?: number;
  h?: number;
  tailX: number;
  tailY: number;
  children: ReactNode;
}) {
  // The tail is a little wedge from the bubble's edge, on the side facing
  // the speaker; the bubble then covers the wedge's base.
  const angle = Math.atan2((tailY - y) / h, (tailX - x) / w);
  const edge = (turn: number) =>
    `${(x + (Math.cos(angle + turn) * w) / 2.2).toFixed(1)} ${(y + (Math.sin(angle + turn) * h) / 2.2).toFixed(1)}`;
  return (
    <g>
      <path d={`M${edge(-0.32)}L${tailX} ${tailY}L${edge(0.32)}Z`} className="fill-surface" />
      <ellipse cx={x} cy={y} rx={w / 2} ry={h / 2} className="fill-surface" />
      <path d={`M${edge(-0.26)}L${edge(0.26)}`} strokeWidth={3} className="stroke-surface" />
      <g transform={`translate(${x} ${y})`}>{children}</g>
    </g>
  );
}

// A four-pointed twinkle.
export function Sparkle({ x, y, size = 1 }: At & { size?: number }) {
  return (
    <path
      d="M0-5c.4 3 1.2 4.4 5 5-3.8.6-4.6 2-5 5-.4-3-1.2-4.4-5-5 3.8-.6 4.6-2 5-5Z"
      transform={`translate(${x} ${y}) scale(${size})`}
      strokeWidth={1.5 / size}
      className="fill-surface"
    />
  );
}

// A bookmark ribbon, centred on x/y.
export function Bookmark({ x, y, turn = 0 }: At & { turn?: number }) {
  return <Shaded d="M-5-7h10v14l-5-3.6-5 3.6Z" transform={`translate(${x} ${y}) rotate(${turn})`} />;
}

// A little heart, filled with marker.
export function Heart({ x, y, size = 1 }: At & { size?: number }) {
  return (
    <Shaded
      d="M0-1.6c-1.4-2.8-5.4-2.4-5.4.8 0 2.8 3 4.6 5.4 6.4 2.4-1.8 5.4-3.6 5.4-6.4 0-3.2-4-3.6-5.4-.8Z"
      transform={`translate(${x} ${y}) scale(${size})`}
    />
  );
}

// Linkwell's chain link: the two loops from the app icon. x/y is its middle;
// weight is the line's thickness, whatever the size.
export function ChainLink({ x, y, size = 1, weight = 3.2 }: At & { size?: number; weight?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size}) translate(-32 -32)`} strokeWidth={weight / size}>
      <path d="M29.5 34.5a8 8 0 0 0 11.3 0l7-7a8 8 0 0 0-11.3-11.3l-2.6 2.6" />
      <path d="M34.5 29.5a8 8 0 0 0-11.3 0l-7 7a8 8 0 0 0 11.3 11.3l2.6-2.6" />
    </g>
  );
}
