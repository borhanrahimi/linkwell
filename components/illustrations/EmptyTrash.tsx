import { Drawing, Hand, Head, Legs, Limb, Shaded, Shadow, Sparkle, Tee } from "@/components/illustrations/Character";

// Nothing in the Trash: the Linkwell character lifts the bin's lid to show
// it's empty, waving with the other hand. A few twinkles: all clean.
export default function EmptyTrash({ className = "" }: { className?: string }) {
  return (
    <Drawing className={className}>
      <Legs x={62} y={36} />
      <Tee x={62} y={36} />

      {/* the bin: the dark opening, the body, a few ridges */}
      <Shadow x={108} y={95} width={30} />
      <Shaded d="M94 68h28l-3 26h-22Z" />
      <Shaded strong d="M94 68c0-1.8 28-1.8 28 0s-28 1.8-28 0Z" />
      <path d="M102 73l1 16M108 73v16M114 73l-1 16" strokeWidth={1.2} />

      {/* the lid, lifted up and held at its edge */}
      <Shaded d="M96 52l26-7 1 3.2-26 7Z" />
      <path d="M108 47.6l-.8-3 4-1 .8 3" strokeWidth={1.3} />
      <Limb d="M77 46l9 6 9-1.6" />
      <Hand x={96} y={51.4} />

      {/* the other hand waves */}
      <Limb d="M47 46l-8-5-2-10" />
      <Hand x={37} y={30} />
      <Head x={62} y={23} tilt={4} />

      <Sparkle x={103} y={60} size={0.6} />
      <Sparkle x={118} y={58} size={0.8} />
      <Sparkle x={130} y={36} size={0.6} />
    </Drawing>
  );
}
