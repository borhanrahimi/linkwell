import Image from "next/image";

type AvatarProps = {
  name: string;
  image?: string | null;
  size?: number;
};

// The user's Google profile picture, or the first letter of their name when
// there's none. Decorative (alt=""): the name is always written next to it.
export default function Avatar({ name, image, size = 28 }: AvatarProps) {
  if (image) {
    return (
      <Image
        src={image}
        alt=""
        width={size}
        height={size}
        unoptimized
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full ring-1 ring-line"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-hover font-semibold text-ink"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
