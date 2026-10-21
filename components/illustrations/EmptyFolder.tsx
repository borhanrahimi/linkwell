import { Drawing, Hand, Head, Legs, Limb, Shaded, Tee } from "@/components/illustrations/Character";

// An empty folder: the Linkwell character holds a paper folder open and peers
// inside. Nothing there yet, only a moth fluttering out.
export default function EmptyFolder({ className = "" }: { className?: string }) {
  return (
    <Drawing className={className}>
      <Legs x={80} y={32} />
      <Tee x={80} y={32} />
      <Head x={80} y={19} tilt={-6} />

      {/* a little moth flutters out of the empty folder */}
      <path d="M104 50c6-6 10-8 16-8" strokeDasharray="1 4" />
      <Shaded d="M128 40c-6-6-12-2-8 3 2 2 5 1 8-3ZM128 40c2-8 9-9 9-3 0 3-4 4-9 3Z" />
      <path d="M128 40l-3 4M126.6 36.4l-1.6-3" strokeWidth={1.1} />

      <Limb d="M64.4 42l-8 12 0 12M95.6 42l8 12 0 12" />
      {/* the folder: the back with a tab on its left, the front opened forward */}
      <Shaded d="M58 50v-4h14l3 4h27v32H58Z" />
      <Shaded d="M52 64h56l-4 18H56Z" />
      <Hand x={55} y={68} />
      <Hand x={105} y={68} />
    </Drawing>
  );
}
