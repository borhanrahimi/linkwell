import { ChainLink, Drawing, Hand, Head, Heart, Legs, Limb, Shaded, Tee } from "@/components/illustrations/Character";

// Keep them alive: the Linkwell character in a doctor's coat, listening with
// a stethoscope to a chain link's heartbeat: Linkwell checks that saved links
// still work. The link is the one from Linkwell's app icon, whole and healthy.
export default function LinkDoctor({ className = "" }: { className?: string }) {
  return (
    <Drawing className={className}>
      {/* a heartbeat line and a heart above the patient */}
      <path d="M100 22h8l3-6 4 12 3-6h8" strokeWidth={1.5} />
      <Heart x={138} y={22} />

      {/* the patient: Linkwell's chain link */}
      <ChainLink x={124} y={60} size={1.1} weight={3.6} />

      <Legs x={52} y={42} />
      <Tee x={52} y={42} />
      {/* the white coat, open over the T-shirt, longer than it */}
      <g transform="translate(52 42)">
        <path d="M-4 0C-8 .2-11 1.2-13 3l-3.4 7 5 2.4-.8 27.2H-2L-3.4 5Z" className="fill-surface" />
        <path d="M4 0C8 .2 11 1.2 13 3l3.4 7-5 2.4.8 27.2H2L3.4 5Z" className="fill-surface" />
        <path d="M-10 24h5" strokeWidth={1.3} />
      </g>

      {/* the stethoscope: round the neck, down, and out to the link */}
      <path d="M46 44c-2 8 1 12 6 14 5-2 8-6 6-14" strokeWidth={1.5} />
      <path d="M52 58c4 12 28 10 48 0" strokeWidth={1.5} />
      <Shaded strong d="M100 58a3.6 3.6 0 1 0 7.2 0 3.6 3.6 0 1 0-7.2 0Z" />

      <Limb d="M36.4 51.6l-3 18M67.6 51.6l14 10 18 0" />
      <Hand x={33.4} y={70} />
      <Hand x={99} y={62} />
      <Head x={52} y={29} tilt={6} />
    </Drawing>
  );
}
