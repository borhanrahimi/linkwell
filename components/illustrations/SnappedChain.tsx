// A chain link snapped in two, for broken links: the two halves pulled apart,
// with little sparks where it broke. Drawn in currentColor, so the Broken
// badge's red colours it. Decoration only; the badge still says "Broken".
export default function SnappedChain({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {/* the two halves of the link, pulled apart */}
      <path d="M9.4 15.2l-2.9 2.8c-1.3 1.3-3.3 1.2-4.5-.1-1.2-1.2-1.2-3.1.1-4.4l2.8-2.8c1-1 2.5-1.2 3.7-.6" />
      <path d="M14.6 8.8l2.9-2.8c1.3-1.3 3.3-1.2 4.5.1 1.2 1.2 1.2 3.1-.1 4.4l-2.8 2.8c-1 1-2.5 1.2-3.7.6" />
      {/* sparks in the gap where it snapped */}
      <path d="M12 7.2v2.2" />
      <path d="M12 14.6v2.2" />
      <path d="M9.6 8.4l-1.1-1.1" />
      <path d="M14.4 15.6l1.1 1.1" />
    </svg>
  );
}
