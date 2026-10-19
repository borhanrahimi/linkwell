"use client";

import { authClient } from "@/lib/auth-client";

export default function SignInButton() {
  return (
    <button
      onClick={() => authClient.signIn.social({ provider: "google" })}
      className="btn-primary mt-6"
    >
      Sign in with Google
    </button>
  );
}
