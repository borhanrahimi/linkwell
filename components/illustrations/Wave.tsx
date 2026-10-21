import { Bubble, Drawing, Hand, Head, Legs, Limb, Sparkle, Tee } from "@/components/illustrations/Character";

// The sign-in screen's welcome: the Linkwell character waves and says "Hi!".
// With goodbye, it's the farewell after deleting an account: waving the other
// hand, saying "Bye!", while a paper plane flies away.
export default function Wave({ goodbye = false, className = "" }: { goodbye?: boolean; className?: string }) {
  return (
    <Drawing className={className}>
      <Legs x={70} y={42} />
      <Tee x={70} y={42} />
      {goodbye ? (
        <>
          {/* a paper plane flying off, with a dotted trail */}
          <path d="M44 34c-6-4-10-10-12-18" strokeDasharray="1 4" />
          <path d="M22 12l16-2-8 12-1.6-5.4Z" className="fill-surface" />
          <path d="M38 10l-9.6 6.6" strokeWidth={1.3} />
          <Limb d="M54.4 51.6l-8 -10 -2-14M85.6 51.6l4 18" />
          <Hand x={44.4} y={25.6} />
          <Hand x={89.6} y={71.6} />
          <path d="M38 24c-1.6 1.8-1.8 4-.8 6M50 22c1.6 1.6 2 3.8 1.2 6" strokeWidth={1.3} />
          <Head x={70} y={29} tilt={-6} />
          <Bubble x={114} y={20} w={36} h={22} tailX={84} tailY={26}>
            {/* "Bye!" in pen */}
            <path
              d="M-11-5v10M-11-5h3c3 0 3 4.6 0 4.6h-3M-11-.4h3.6c3.2 0 3.2 5.4 0 5.4h-3.6M-3-1.4l2.6 4.4M2-1.4l-4.4 9M3.8 2.4h4.2c0-2.4-1.4-3.6-2.4-3.6-1.8 0-2.6 2-2.4 3.6.2 1.8 2 2.8 4.2 1.8M11.4-5v7M11.4 5h.01"
              strokeWidth={1.5}
            />
          </Bubble>
        </>
      ) : (
        <>
          <Sparkle x={30} y={40} size={0.6} />
          <Limb d="M54.4 51.6l-4 18M85.6 51.6l8-10 2-14" />
          <Hand x={49.6} y={71.6} />
          <Hand x={95.6} y={25.6} />
          <path d="M102 22c1.6 1.8 1.8 4 .8 6M90 20c-1.6 1.6-2 3.8-1.2 6" strokeWidth={1.3} />
          <Head x={70} y={29} tilt={6} />
          <Bubble x={128} y={22} w={30} h={22} tailX={106} tailY={30}>
            {/* "Hi!" in pen */}
            <path d="M-8-5v10M-8 0h5.4M-2.6-5v10M2.6-1v6M2.6-4h.01M7.6-5v7M7.6 5h.01" strokeWidth={1.6} />
          </Bubble>
        </>
      )}
    </Drawing>
  );
}
