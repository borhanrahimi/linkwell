import { Arm, Bookmark, Drawing, Fist, Head, Sparkle, Tee } from "@/components/illustrations/Character";

// No links yet: the Linkwell character holds up an open, empty box, with a
// bookmark floating down, ready to be the first thing inside.
export default function EmptyBox({ className = "" }: { className?: string }) {
  return (
    <Drawing className={className}>
      <Tee x={80} y={36} />
      <Head x={80} y={36} />

      {/* a bookmark on its way in, and a twinkle */}
      <Bookmark x={124} y={30} turn={-16} />
      <path d="M116 42c-3 4-6 8-10.4 12.4" strokeDasharray="1 4.4" />
      <Sparkle x={36} y={34} size={0.7} />

      {/* the open box: flaps folded out, an empty inside, the front */}
      <path d="M57 88L41 82l6-9 17 7Z" className="fill-surface" />
      <path d="M103 88l16-6-6-9-17 7Z" className="fill-surface" />
      <path d="M57 88l7-8h32l7 8Z" className="fill-surface" />
      <path d="M64 80l3 8M96 80l-3 8" strokeWidth={1.6} />
      <path d="M70 82.4l-2 3.6M76 82.4l-2 3.6M82 82.4l-2 3.6M88 82.4l-2 3.6" strokeWidth={1.2} />
      <path d="M57 88h46v32H57Z" className="fill-surface" />
      <path d="M72 100h16" strokeWidth={1.6} />

      {/* forearms in front of the T-shirt, hands on the box's sides */}
      <Arm d="M44 120l12-12" />
      <Arm d="M116 120l-12-12" />
      <Fist x={57} y={108} />
      <Fist x={103} y={108} />
    </Drawing>
  );
}
