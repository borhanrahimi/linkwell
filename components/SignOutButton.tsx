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
      className="btn-quiet"
    >
      Sign out
    </button>
  );
}
