"use client";

import { authClient } from "@/lib/auth-client";

// callbackURL is where Google sends you back to after signing in.
export default function SignInButton({ callbackURL = "/" }: { callbackURL?: string }) {
  return (
    <button
      onClick={() => authClient.signIn.social({ provider: "google", callbackURL })}
      className="btn-primary mt-6"
    >
      Sign in with Google
    </button>
  );
}
