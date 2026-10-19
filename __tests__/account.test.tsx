import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import Avatar from "@/components/Avatar";
import UsernameForm from "@/components/UsernameForm";
import { saveUsername } from "@/app/actions";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/app/actions", () => ({
  saveUsername: vi.fn(async () => null),
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
