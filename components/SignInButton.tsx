"use client";

import { authClient } from "@/lib/auth-client";

export default function SignInButton() {
  return (
    <button
      onClick={() => authClient.signIn.social({ provider: "google" })}
      className="mt-6 rounded bg-blue-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      Sign in with Google
    </button>
  );
}
