import type { ReactNode } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import SignOutButton from "@/components/SignOutButton";

type HeaderProps = {
  user: { name: string; image?: string | null; username?: string | null };
  // Something to put in the middle of the bar: the save box, on the links page.
  children?: ReactNode;
};

// The floating glass bar at the top of every signed-in page. The links scroll
// underneath it. Your picture and name lead to your account page.
// On phones, the middle part (the save box) gets a row of its own.
export default function Header({ user, children }: HeaderProps) {
  return (
    <header
      className={`glass-bar sticky top-3 z-10 flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5 pl-5 pr-1.5 ${
        children ? "rounded-[1.75rem]" : "rounded-full"
      }`}
    >
      <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight text-ink">
        Linkwell
      </Link>
      {children && (
        <div className="order-last w-full pr-3.5 pb-1.5 md:order-none md:w-auto md:flex-1 md:pr-0 md:pb-0">
          {children}
        </div>
      )}
      <div className="ml-auto flex min-w-0 items-center gap-1">
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
