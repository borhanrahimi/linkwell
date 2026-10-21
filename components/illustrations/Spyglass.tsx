import { Bookmark, Drawing, Hand, Head, Limb, Shaded, Sparkle, Tee } from "@/components/illustrations/Character";

// The Rediscover banner's drawing, made wide and short to fit it: the Linkwell
// character, from the shoulders up, looks through a spyglass at a bookmark
// shining up in the corner: an old link, found again.
export default function Spyglass({ className = "" }: { className?: string }) {
  return (
    <Drawing viewBox="0 0 120 64" className={className}>
      {/* what they see */}
      <Bookmark x={102} y={15} turn={12} />
      <path d="M102 3.4V1.4M111.6 9l2-1M92.4 8.4l-2-1" strokeWidth={1.3} />
      <Sparkle x={88} y={34} size={0.5} />
      <Sparkle x={112} y={40} size={0.4} />

      <Tee x={34} y={52} />
      <Head x={34} y={39} tilt={-4} />
      <Limb d="M49 62l8-14v-17" />

      {/* the spyglass, pressed to the glasses, and a darker front ring */}
      <Shaded d="M42.4 39.7l31-16-2.8-5.4-31 16Z" />
      <Shaded strong d="M73.8 24.6l3-1.6-3.6-7.1-3 1.5Z" />
      <Hand x={57} y={30} />
    </Drawing>
  );
}
