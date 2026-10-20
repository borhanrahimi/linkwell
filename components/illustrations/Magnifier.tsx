import { Arm, Drawing, Fist, Head, Tee } from "@/components/illustrations/Character";

// No search results: the Linkwell character searches with a magnifying glass,
// one eye huge behind the lens, and finds only question marks.
export default function Magnifier({ className = "" }: { className?: string }) {
  return (
    <Drawing className={className}>
      {/* question marks */}
      <path d="M116 30c0-3.4 2.6-5.6 5.6-5.6s5.4 2.2 5.4 5c0 3.4-4 4-5 7.2" />
      <path d="M122 43h.01" strokeWidth={3} />
      <path d="M136 50c0-2.4 1.8-4 4-4s3.8 1.6 3.8 3.6c0 2.4-2.8 2.8-3.6 5" strokeWidth={1.8} />
      <path d="M140.2 59.6h.01" strokeWidth={2.6} />

      {/* the arm, from behind the shoulder up to the handle */}
      <Arm d="M90 108l14-18-8-16" />
      <Tee x={64} y={50} />
      <Head x={64} y={50} />

      {/* the magnifying glass: a big eye behind the lens, a thick ring, a black handle */}
      <path d="M86.4 62.4l10 11.6" strokeWidth={6} />
      <circle cx={72} cy={50} r={13} strokeWidth={3.6} className="fill-surface" />
      <circle cx={72} cy={50.6} r={4.6} stroke="none" className="fill-ink" />
      <circle cx={73.8} cy={48.8} r={1.4} stroke="none" className="fill-surface" />
      <path d="M64.4 44c1.2-2.2 3.2-3.6 5.6-4" strokeWidth={1.6} />
      <Fist x={96.6} y={75} />
    </Drawing>
  );
}
