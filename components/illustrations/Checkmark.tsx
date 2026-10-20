// A hand-drawn checkmark for read links: one quick pen stroke, with a little
// loop where the pen turns and a tail that overshoots, like ticking a list by
// hand. Drawn in currentColor; decoration only, the label still says "Read".
export default function Checkmark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3.6 12.4c1.6.4 3.4 2.4 5 5.4.4.8 1 .8 1.4 0C12.8 12 16.4 7.4 21 4.2" />
    </svg>
  );
}
