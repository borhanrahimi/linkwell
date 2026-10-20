import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SignInButton from "@/components/SignInButton";
import SignOutButton from "@/components/SignOutButton";
import { authClient } from "@/lib/auth-client";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { social: vi.fn(async () => {}) },
    signOut: vi.fn(async () => {}),
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SignInButton", () => {
  test("starts signing in with Google", () => {
    render(<SignInButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));
    expect(authClient.signIn.social).toHaveBeenCalledWith({ provider: "google", callbackURL: "/" });
  });

  test("comes back to the given page after signing in", () => {
    render(<SignInButton callbackURL="/share?url=https%3A%2F%2Fexample.com%2F" />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));
    expect(authClient.signIn.social).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/share?url=https%3A%2F%2Fexample.com%2F",
    });
  });
});

describe("SignOutButton", () => {
  test("signs out and refreshes the page", async () => {
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(authClient.signOut).toHaveBeenCalled();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
