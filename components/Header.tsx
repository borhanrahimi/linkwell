import Link from "next/link";
import Avatar from "@/components/Avatar";
import SignOutButton from "@/components/SignOutButton";

type HeaderProps = {
  user: { name: string; image?: string | null; username?: string | null };
};

// The floating glass bar at the top of every signed-in page. The links scroll
// underneath it. Your picture and name lead to your account page.
export default function Header({ user }: HeaderProps) {
  return (
    <header className="glass-bar sticky top-3 z-10 flex items-center justify-between gap-4 rounded-full py-1.5 pl-5 pr-1.5">
      <Link href="/" className="text-lg font-semibold tracking-tight text-ink">
        Linkwell
      </Link>
      <div className="flex min-w-0 items-center gap-1">
        <Link
          href="/account"
          className="flex min-w-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium text-ink hover:bg-hover focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <Avatar name={user.name} image={user.image} />
          <span className="truncate">{user.username ? `@${user.username}` : user.name}</span>
        </Link>
        <SignOutButton />
      </div>
    </header>
  );
}
