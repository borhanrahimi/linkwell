// Rediscover's illustration: a little character looking through a telescope
// at a star, like finding an old link again. Our own drawing, in the
// illustration style of v1.6: ink lines (currentColor, so they turn light in
// dark mode) with two flat colours, Rediscover's violet and a yellow star.
// Purely decorative, so it's hidden from screen readers.
export default function Stargazer({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`text-ink ${className}`}
    >
      {/* the ground */}
      <path d="M8 109c30-2.2 70-2.6 144-.6" />

      {/* tripod */}
      <path d="M91 64.5L77.5 107" />
      <path d="M91 64.5l13.8 42.6" />
      <path d="M91 64.5l.6 42.7" />

      {/* telescope: a violet tube, a band and the big lens end */}
      <path d="M63.6 69.6l56.1-35.5 8.6 15.8-59.9 28.5c-2.6.4-4.6-.6-5.7-2.7-1-2-.7-4.2.9-6.1Z" className="fill-highlight" />
      <path d="M94.4 50.1l7 12.6" />
      <path d="M117.6 30.4c2.2-1.6 5-.8 7.4 3.4l5.1 9.4c2.2 4.2 1.7 7-.6 8.3" />

      {/* the character: a round body leaning in to the eyepiece */}
      <path d="M44 61.5c12.6.2 20.3 9.8 20 22.6-.3 13.3-8.4 21.6-20.3 21.4-12.2-.2-20.4-8.9-20.2-21.8.2-12.6 8.3-22.4 20.5-22.2Z" className="fill-surface" />
      {/* a tuft of hair */}
      <path d="M41.6 61.8c-2.8-4.6-.4-8.6 3.6-7.4" />
      {/* one eye shut tight, the other one is at the telescope */}
      <path d="M46.4 76.6c1.8-2.2 4.4-2.4 6.4-.2" />
      {/* a small happy smile */}
      <path d="M48.8 87.4c2 2.2 5 2.4 7.2.2" />
      {/* the arm, holding the tube steady */}
      <path d="M56.6 94.2c5.4-1.4 10.6-6.6 13.4-14.2" />
      {/* feet */}
      <path d="M36.4 105.2l-1.8 3.6" />
      <path d="M51.6 105.4l1.8 3.4" />

      {/* the star it found, and a few sparkles */}
      <path
        d="M142 8.5l2.8 6.9 7.2.6-5.5 4.7 1.7 7.1-6.2-3.8-6.2 3.8 1.7-7.1-5.5-4.7 7.2-.6Z"
        className="fill-folder-yellow"
      />
      <path d="M113 8.5v8M109 12.5h8" strokeWidth={2} />
      <path d="M150.5 42v6M147.5 45h6" strokeWidth={2} />
      <path d="M128 21.5h.01" strokeWidth={4} />
    </svg>
  );
}
