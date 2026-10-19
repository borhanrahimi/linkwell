import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import Avatar from "@/components/Avatar";
import UsernameForm from "@/components/UsernameForm";
import DeleteAccount from "@/components/DeleteAccount";
import { authClient } from "@/lib/auth-client";
import { saveUsername } from "@/app/actions";

const refresh = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
}));

vi.mock("@/app/actions", () => ({
  saveUsername: vi.fn(async () => null),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    deleteUser: vi.fn(async () => ({ data: { success: true }, error: null })),
    signIn: { social: vi.fn(async () => { }) },
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Avatar", () => {
  test("shows the profile picture", () => {
    render(<Avatar name="Ada" image="https://example.com/ada.png" />);

    expect(document.querySelector("img")?.getAttribute("src")).toBe("https://example.com/ada.png");
  });

  test("shows the first letter when there's no picture", () => {
    render(<Avatar name="ada" image={null} />);

    expect(screen.getByText("A")).toBeDefined();
  });
});

describe("UsernameForm", () => {
  async function save(username: string) {
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: username } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
  }

  test("starts with the current username", () => {
    render(<UsernameForm initialUsername="ada" />);

    expect(screen.getByLabelText("Username")).toHaveProperty("value", "ada");
  });

  test("saves the username and refreshes the page", async () => {
    render(<UsernameForm />);

    await save("Ada_L");

    expect(saveUsername).toHaveBeenCalledWith("Ada_L");
    expect(screen.getByRole("status").textContent).toBe("Saved. You're @ada_l now.");
    expect(refresh).toHaveBeenCalled();
  });

  test("shows the server's error and doesn't refresh", async () => {
    vi.mocked(saveUsername).mockResolvedValueOnce("@ada is already taken.");
    render(<UsernameForm />);

    await save("ada");

    expect(screen.getByRole("alert").textContent).toBe("@ada is already taken.");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("DeleteAccount", () => {
  function openAndType(word: string) {
    fireEvent.click(screen.getByRole("button", { name: "Delete my account…" }));
    fireEvent.change(screen.getByLabelText("Type delete to confirm"), { target: { value: word } });
  }

  test("asks you to type 'delete' before it can delete", () => {
    render(<DeleteAccount />);

    openAndType("delet");

    expect(screen.getByRole("button", { name: "Delete forever" })).toHaveProperty("disabled", true);
  });

  test("deletes the account and goes to the goodbye screen", async () => {
    render(<DeleteAccount />);
    openAndType(" Delete ");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete forever" }));
    });

    expect(authClient.deleteUser).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/?deleted=1");
  });

  test("asks you to sign in again when the session is too old", async () => {
    vi.mocked(authClient.deleteUser).mockResolvedValueOnce({
      data: null,
      error: { code: "SESSION_EXPIRED", message: "Session expired.", status: 400, statusText: "Bad Request" },
    } as never);
    render(<DeleteAccount />);
    openAndType("delete");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete forever" }));
    });

    expect(screen.getByRole("alert").textContent).toBe("For your safety, please sign in again before deleting your account.");
    expect(push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(authClient.signIn.social).toHaveBeenCalledWith({ provider: "google", callbackURL: "/account" });
  });

  test("Cancel closes the confirmation", () => {
    render(<DeleteAccount />);
    openAndType("delete");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Type delete to confirm")).toBeNull();
  });
});
