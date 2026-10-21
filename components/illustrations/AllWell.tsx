import { ChainLink, Drawing, Hand, Head, Heart, Legs, Limb, Shadow, Sparkle, Tee } from "@/components/illustrations/Character";

// No broken links: the Linkwell character gives a thumbs-up next to Linkwell's
// chain link, whole and healthy, with a little heart above it.
export default function AllWell({ className = "" }: { className?: string }) {
  return (
    <Drawing className={className}>
      {/* the healthy link, its heart and a couple of twinkles */}
      <ChainLink x={120} y={64} size={1.25} weight={3.6} />
      <Shadow x={120} y={99} width={30} />
      <Heart x={132} y={28} />
      <path d="M124 22l-2-2M140 22l2-2" strokeWidth={1.3} />
      <Sparkle x={100} y={30} size={0.5} />
      <Sparkle x={150} y={82} size={0.45} />

      <Legs x={56} y={42} />
      <Tee x={56} y={42} />
      {/* one hand on the hip, the other up: a thumbs-up */}
      <Limb d="M40.4 51.6l-6 10 8 6M71.6 51.6l10 0 2-14" />
      <Hand x={42.4} y={67.6} />
      <path d="M82.4 35.4v-5c0-2 3-2 3 0v5" className="fill-surface" strokeWidth={1.5} />
      <circle cx={83.6} cy={38.6} r={3.4} className="fill-surface" strokeWidth={1.5} />
      <Head x={56} y={29} tilt={-4} />
    </Drawing>
  );
}
