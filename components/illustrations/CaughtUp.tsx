import { Bubble, Drawing, Hand, Head, Limb, Shaded, Shadow, Shoe, Tee } from "@/components/illustrations/Character";

// Nothing unread: the Linkwell character sits back at a little café table with
// a warm cup of tea. A tick in the speech bubble: every link has been read.
export default function CaughtUp({ className = "" }: { className?: string }) {
  return (
    <Drawing className={className}>
      <Shadow x={78} y={99} width={84} />

      {/* the chair behind them */}
      <path d="M38 48v50M74 48v50M38 77h36" strokeWidth={1.6} />

      {/* sitting: legs down from the seat, feet on the ground */}
      <Limb d="M51.6 77l-1.6 20M60.4 77l1.6 20" />
      <Shoe x={48} y={97.6} facing={-1} />
      <Shoe x={64} y={97.6} />
      <Tee x={56} y={47} />

      {/* the café table and the cup, with steam */}
      <path d="M108 76v20M98 97h20" strokeWidth={1.8} />
      <Shaded d="M84 74c0-2.4 10-4 24-4s24 1.6 24 4-10 4-24 4-24-1.6-24-4Z" />
      <path d="M112 64c4 0 4.6 6 0 6" strokeWidth={1.5} />
      <Shaded d="M100 61h12v8a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4Z" />
      <path d="M104 56c-2-2 2-3.4 0-5.4M109 56c-2-2 2-3.4 0-5.4" strokeWidth={1.3} />

      {/* one hand resting in the lap, the other round the cup */}
      <Limb d="M40.4 56.6l-2 12 12 6M71.6 56.6l12 8 14 0" />
      <Hand x={50} y={74.6} />
      <Hand x={99} y={66} />
      <Head x={56} y={34} tilt={-6} />

      <Bubble x={98} y={22} w={26} h={20} tailX={72} tailY={30}>
        <path d="M-6 .4l4 4.2 8-9" strokeWidth={2} />
      </Bubble>
    </Drawing>
  );
}
