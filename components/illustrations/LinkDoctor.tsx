import { Arm, Drawing, Fist, Head, Tee } from "@/components/illustrations/Character";

// Keep them alive: the Linkwell character as a doctor, listening with a
// stethoscope to a chain link's heartbeat: Linkwell checks that saved links
// still work. The link is the one from Linkwell's app icon, whole and healthy.
export default function LinkDoctor({ className = "" }: { className?: string }) {
  return (
    <Drawing className={className}>
      {/* a heartbeat line, and a little heart */}
      <path d="M96 22h10l3.4-7 4.6 14 3.6-7h10" strokeWidth={1.8} />
      <path d="M137 18.6c-1.2-2.4-4.8-2-4.8.8 0 2.4 2.6 4 4.8 5.6 2.2-1.6 4.8-3.2 4.8-5.6 0-2.8-3.6-3.2-4.8-.8Z" className="fill-ink" />

      {/* the patient: Linkwell's chain link (the app icon's two loops), scaled up */}
      <g transform="translate(88 30) scale(1.1)" strokeWidth={4}>
        <path d="M29.5 34.5a8 8 0 0 0 11.3 0l7-7a8 8 0 0 0-11.3-11.3l-2.6 2.6" />
        <path d="M34.5 29.5a8 8 0 0 0-11.3 0l-7 7a8 8 0 0 0 11.3 11.3l2.6-2.6" />
      </g>

      {/* the arm, from behind the shoulder, holding the chest piece to the link */}
      <Arm d="M80 104l20-12 6-10" />
      <Tee x={56} y={44} />

      {/* the stethoscope: from both ears down to the chest, then out to the
          link. A thick ink line with a white one on top shows on the black
          T-shirt too. Drawn before the head, so the ear ends tuck behind it. */}
      {[
        "M42.6 47c-2.4 10 3 18 13.4 21",
        "M69.4 47c2.4 10-3 18-13.4 21",
        "M56 68c0 10 22 14 50 10",
      ].map((d) => (
        <g key={d}>
          <path d={d} strokeWidth={5} />
          <path d={d} strokeWidth={2.2} className="stroke-surface" />
        </g>
      ))}
      <Head x={56} y={44} />

      {/* the chest piece on the link, and the hand holding it */}
      <circle cx={108} cy={77} r={5} className="fill-surface" strokeWidth={2.4} />
      <circle cx={108} cy={77} r={1.6} stroke="none" className="fill-ink" />
      <Fist x={103} y={84} />
    </Drawing>
  );
}
