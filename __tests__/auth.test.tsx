import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SignInButton from "@/components/SignInButton";
import { authClient } from "@/lib/auth-client";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { social: vi.fn(async () => {}) },
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
    expect(authClient.signIn.social).toHaveBeenCalledWith({ provider: "google" });
  });
});
