import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Home from "@/app/page";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function addLink(url: string) {
  fireEvent.change(screen.getByPlaceholderText("Paste a link..."), {
    target: { value: url },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

describe("Home page", () => {
  test("shows a message when there are no links", () => {
    render(<Home />);

    expect(screen.getByText("No links yet. Add your first one above.")).toBeDefined();
  });

  test("adds a link to the list", () => {
    render(<Home />);

    addLink("https://example.com");

    expect(screen.getByRole("link", { name: "https://example.com" })).toBeDefined();
    expect(screen.queryByText("No links yet. Add your first one above.")).toBeNull();
  });

  test("ignores an empty link", () => {
    render(<Home />);

    addLink("   ");

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  test("keeps links after a page refresh", () => {
    render(<Home />);
    addLink("https://example.com");

    cleanup();
    render(<Home />);
    expect(screen.getByRole("link", { name: "https://example.com" })).toBeDefined();
  });

  test("keeps a deleted link removed after a page refresh", () => {
    render(<Home />);
    addLink("https://example.com");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    cleanup();
    render(<Home />);
    expect(screen.queryByRole("link", { name: "https://example.com" })).toBeNull();
  });

  test("deletes a link", () => {
    render(<Home />);
    addLink("https://example.com");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.queryByRole("link", { name: "https://example.com" })).toBeNull();
  });
});
 