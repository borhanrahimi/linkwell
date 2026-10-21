import { Bookmark, Drawing, Hand, Head, Legs, Limb, Shaded, Sparkle, Tee } from "@/components/illustrations/Character";

// No links yet: the Linkwell character holds up an open, empty box, with a
// bookmark floating down, ready to be the first thing inside.
export default function EmptyBox({ className = "" }: { className?: string }) {
  return (
    <Drawing className={className}>
      <Legs x={80} y={32} />
      <Tee x={80} y={32} />
      <Head x={80} y={19} />

      {/* a bookmark on its way in, and a twinkle */}
      <Bookmark x={126} y={24} turn={-16} />
      <path d="M120 36c-4 6-8 12-14 18" strokeDasharray="1 4" />
      <Sparkle x={36} y={30} size={0.7} />

      {/* the arms reach down to the box's sides */}
      <Limb d="M64.4 42l-6 12 2 12M95.6 42l6 12-2 12" />

      {/* the open box: the dark inside, flaps folded out, the front */}
      <Shaded strong d="M60 62l4-6h32l4 6Z" />
      <Shaded d="M60 62l-13-4 4-7 13 5Z" />
      <Shaded d="M100 62l13-4-4-7-13 5Z" />
      <Shaded d="M60 62h40v20H60Z" />
      <path d="M74 70h12" strokeWidth={1.4} />
      <Hand x={60.4} y={67} />
      <Hand x={99.6} y={67} />
    </Drawing>
  );
}
