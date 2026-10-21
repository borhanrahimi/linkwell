// Linkwell's chain link in ink line art, before the name in the top bar and on
// the legal pages. It matches the app icon's loops and the drawings' style.
export default function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="12 12 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M29.5 34.5a8 8 0 0 0 11.3 0l7-7a8 8 0 0 0-11.3-11.3l-2.6 2.6" />
      <path d="M34.5 29.5a8 8 0 0 0-11.3 0l-7 7a8 8 0 0 0 11.3 11.3l2.6-2.6" />
    </svg>
  );
}
