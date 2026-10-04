import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Home from "@/app/page";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function addLink(url: string, title = "") {
  fireEvent.change(screen.getByPlaceholderText("Paste a link..."), {
    target: { value: url },
  });
  fireEvent.change(screen.getByPlaceholderText("Title (optional)"), {
    target: { value: title },
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

    expect(screen.getByRole("link", { name: "example.com" })).toBeDefined();
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
    expect(screen.getByRole("link", { name: "example.com" })).toBeDefined();
  });

  test("keeps a deleted link removed after a page refresh", () => {
    render(<Home />);
    addLink("https://example.com");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    cleanup();
    render(<Home />);
    expect(screen.queryByRole("link", { name: "example.com" })).toBeNull();
  });

  test("deletes a link", () => {
    render(<Home />);
    addLink("https://example.com");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.queryByRole("link", { name: "example.com" })).toBeNull();
  });

  test("the link opens the full url", () => {
    render(<Home />);

    addLink("https://example.com/some/page", "My favourite site");

    const link = screen.getByRole("link", { name: "My favourite site" });
    expect(link.getAttribute("href")).toBe("https://example.com/some/page");
  });

  test("shows the title when one is given", () => {
    render(<Home />);

    addLink("https://example.com", "My favourite site");

    expect(screen.getByRole("link", { name: "My favourite site" })).toBeDefined();
  });

  test("keeps the title after a page refresh", () => {
    render(<Home />);
    addLink("https://example.com", "My favourite site");

    cleanup();
    render(<Home />);
    expect(screen.getByRole("link", { name: "My favourite site" })).toBeDefined();
  });


});
 