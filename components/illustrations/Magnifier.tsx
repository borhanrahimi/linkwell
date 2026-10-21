import { Bubble, Drawing, Hand, Head, Legs, Limb, Tee } from "@/components/illustrations/Character";

// No search results: the Linkwell character peers through a big magnifying
// glass, one hand on the hip, and wonders "?".
export default function Magnifier({ className = "" }: { className?: string }) {
  return (
    <Drawing className={className}>
      <Legs x={62} y={40} spread={4} />
      <Tee x={62} y={40} />
      <Head x={64} y={27} tilt={8} />

      {/* one hand on the hip, the other holding the glass out */}
      <Limb d="M46.4 49.6l-6 10 8 6M77.6 49.6l12 8 8-6" />
      <Hand x={48} y={65.6} />

      {/* the magnifying glass: a handle and a big round lens */}
      <path d="M98 51.6l7.6-8" strokeWidth={4} />
      <circle cx={113} cy={35.6} r={11} className="fill-surface" strokeWidth={2.2} />
      <path d="M106 30c1.4-2.4 3.6-3.6 6-3.8" strokeWidth={1.2} />
      <Hand x={98.4} y={51.6} />

      <Bubble x={32} y={16} w={22} h={18} tailX={50} tailY={22}>
        <path d="M-2.6-3.6c0-2 1.4-3 2.8-3s2.8 1 2.8 2.6c0 2.2-2.8 2.4-2.8 4.8M.2 4.4h.01" strokeWidth={1.6} />
      </Bubble>
    </Drawing>
  );
}
