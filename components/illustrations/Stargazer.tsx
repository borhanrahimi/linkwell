import { Bookmark, Drawing, Hand, Head, Legs, Limb, Shaded, Shadow, Sparkle, Tee } from "@/components/illustrations/Character";

// Rediscover: the Linkwell character bends to a telescope on a tripod and
// finds a bookmark shining among the stars: an old link, found again.
export default function Stargazer({ className = "" }: { className?: string }) {
  return (
    <Drawing className={className}>
      {/* what they see: the bookmark with its shine, twinkles and stars */}
      <Bookmark x={140} y={16} turn={12} />
      <path d="M140 4V1.6M150 9.6l2.2-1.2M130.4 8.4l-2.2-1.2M150.4 22l2 1" strokeWidth={1.4} />
      <Sparkle x={124} y={36} size={0.6} />
      <Sparkle x={152} y={44} size={0.45} />
      <path d="M112 6h.01M100 18h.01M146 60h.01" strokeWidth={2.6} />

      {/* the tripod and the telescope */}
      <Shadow x={88} y={99} width={34} />
      <g transform="translate(-2 5)">
      <path d="M84 29L72 98M84 29l2 69M84 29l17 69" strokeWidth={1.6} />
      <Shaded d="M70.6 30.6l36-16-3.2-7.2-36 16Z" />
      <Shaded strong d="M107.2 15.9l3.6-1.6-3.6-9.8-3.6 1.6Z" />
      <Shaded strong d="M69.8 28.8l-5 2.2-1.6-3.6 5-2.2Z" />
      </g>

      {/* the stargazer, bent to the eyepiece, one hand steadying the tube */}
      <Legs x={52} y={44} />
      <Tee x={52} y={44} />
      <Limb d="M36.4 53.6l-3 17M67.6 53.6l8-4 2-18" />
      <Hand x={33.4} y={70.6} />
      <Head x={56} y={30} tilt={10} />
      <Hand x={77.6} y={31} />
    </Drawing>
  );
}
