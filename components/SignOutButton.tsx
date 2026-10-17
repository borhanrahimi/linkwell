"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignOutButton() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        await authClient.signOut();
        // Re-render the Server Component page, which now finds no session.
        router.refresh();
      }}
      className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      Sign out
    </button>
  );
}
