"use client";

import { authClient } from "@/lib/auth-client";

type SignInButtonProps = {
  // Where Google sends you back to after signing in.
  callbackURL?: string;
  label?: string;
  className?: string;
};

export default function SignInButton({
  callbackURL = "/",
  label = "Sign in with Google",
  className = "btn-primary mt-6",
}: SignInButtonProps) {
  return (
    <button onClick={() => authClient.signIn.social({ provider: "google", callbackURL })} className={className}>
      {label}
    </button>
  );
}
