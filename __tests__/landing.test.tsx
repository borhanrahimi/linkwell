import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import Landing from "@/components/Landing";
import { authClient } from "@/lib/auth-client";

vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { social: vi.fn(async () => {}) } },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("says what Linkwell is, with its three promises", () => {
  render(<Landing />);

  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Save links. Keep them alive. Actually come back to them.");
  for (const promise of ["Save links", "Keep them alive", "Actually come back to them"]) {
    expect(screen.getByRole("heading", { level: 3, name: promise })).toBeDefined();
  }
});

test("every button signs in with Google", () => {
  render(<Landing />);

  for (const name of ["Sign in", "Sign in with Google", "Start saving links"]) {
    fireEvent.click(screen.getByRole("button", { name }));
  }

  expect(authClient.signIn.social).toHaveBeenCalledTimes(3);
  expect(authClient.signIn.social).toHaveBeenCalledWith({ provider: "google", callbackURL: "/" });
});

test("answers the common questions", () => {
  render(<Landing />);

  expect(screen.getByText("Is Linkwell free?")).toBeDefined();
  expect(screen.getByText("Can I take my links with me?")).toBeDefined();
});

test("says goodbye after an account was deleted", () => {
  render(<Landing deleted />);

  expect(screen.getByRole("status").textContent).toBe("Your account and all your links were deleted. Goodbye");
});

test("shows real screenshots of the app, in light and dark versions, described for screen readers", () => {
  render(<Landing />);

  const section = screen.getByRole("region", { name: "What Linkwell looks like" });
  const pictures = within(section).getAllByRole("img");
  const sources = pictures.map((img) => decodeURIComponent(img.getAttribute("src") ?? ""));
  for (const name of ["app-light", "app-dark", "phone-light", "phone-dark"]) {
    expect(sources.some((src) => src.includes(`/screenshots/${name}.png`))).toBe(true);
  }
  for (const img of pictures) {
    expect(img.getAttribute("alt")).toMatch(/^Linkwell on a (computer|phone): /);
  }
});
