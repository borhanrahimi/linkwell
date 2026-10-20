import { Arm, Bookmark, Drawing, Fist, Head, Sparkle, Tee } from "@/components/illustrations/Character";

// Rediscover: the Linkwell character peers through a spyglass at a bookmark
// shining among the stars: an old link, found again.
export default function Stargazer({ className = "" }: { className?: string }) {
  return (
    <Drawing className={className}>
      {/* what they see */}
      <Bookmark x={147} y={16} turn={10} />
      <path d="M147 4.2V2M157.4 11.4l2-1.2M136.8 11.8l-2-1.4" />
      <Sparkle x={152} y={40} size={0.8} />
      <Sparkle x={132} y={44} size={0.55} />
      <path d="M146 58h.01M108 6h.01M128 2h.01" strokeWidth={3} />

      {/* the arm, from behind the shoulder up to the spyglass */}
      <Arm d="M84 104l22-32-12-30" />
      <Tee x={62} y={51} />
      <Head x={62} y={51} />

      {/* the spyglass, pressed to the glasses: three sections and a dark front ring */}
      <path d="M103 35.66l-7.5-11.82 24.74-15.75 7.52 11.82Z" className="fill-surface" />
      <path d="M114.74 11.59l5.5-3.5 7.52 11.82-5.5 3.5Z" className="fill-ink" />
      <path d="M84 45.86l-5.8-9.12 18.15-11.55 5.8 9.12Z" className="fill-surface" />
      <path d="M71.15 52.38l-4.3-6.76 12.1-7.7 4.3 6.76Z" className="fill-surface" />
      <Fist x={93.2} y={39.8} />
    </Drawing>
  );
}
