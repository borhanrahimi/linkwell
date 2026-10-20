import { Arm, Drawing, Head, Palm, Sparkle, Tee } from "@/components/illustrations/Character";

// The sign-in screen's welcome: the Linkwell character waves hello.
// With goodbye, it's the farewell after deleting an account: waving with the
// other hand while a paper plane flies away.
export default function Wave({ goodbye = false, className = "" }: { goodbye?: boolean; className?: string }) {
  return (
    <Drawing className={className}>
      {goodbye ? (
        <>
          {/* a paper plane flying off, with a dotted trail */}
          <path d="M98 70c8-2 14-8 18-16 3-6 6-12 12-16" strokeDasharray="1 4.4" />
          <path d="M126 32l22-10-6 22-5.6-7.4Z" className="fill-surface" />
          <path d="M148 22l-11.6 14.6-1.4 7.4" strokeWidth={1.6} />
          <Arm d="M58 112l-14-26 4-24" />
          <Palm x={47} y={56} turn={-12} />
          <path d="M34 50c-2.4 2.4-3 5.4-2 8.4M30 44c-3.6 3.6-4.4 8.6-2.8 13" strokeWidth={1.6} />
        </>
      ) : (
        <>
          <Sparkle x={36} y={32} size={0.7} />
          <Sparkle x={140} y={86} size={0.5} />
          <Arm d="M102 112l14-26-4-24" />
          <Palm x={113} y={56} turn={12} />
          <path d="M126 50c2.4 2.4 3 5.4 2 8.4M130 44c3.6 3.6 4.4 8.6 2.8 13" strokeWidth={1.6} />
        </>
      )}
      <Tee x={80} y={42} />
      <Head x={80} y={42} />
    </Drawing>
  );
}
