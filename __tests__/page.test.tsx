import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { loadLinks, saveLinks } from "@/lib/links";
import Home from "@/app/page";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function addLink(url: string, title = "", tags = "") {
  fireEvent.change(screen.getByPlaceholderText("Paste a link..."), {
    target: { value: url },
  });
  fireEvent.change(screen.getByPlaceholderText("Title (optional)"), {
    target: { value: title },
  });
  fireEvent.change(screen.getByPlaceholderText("Tags, comma separated"), {
    target: { value: tags },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

test("saves tags with a new link", () => {
  render(<Home />);

  addLink("https://example.com", "", "React, news");

  expect(loadLinks()[0].tags).toEqual(["react", "news"]);
});

test("clears the tags box after saving", () => {
  render(<Home />);

  addLink("https://example.com", "", "react");

  expect(screen.getByPlaceholderText("Tags, comma separated")).toHaveProperty("value", "");
});



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

  test("does not save the same link twice", () => {
    render(<Home />);

    addLink("https://example.com");
    addLink("https://example.com");

    expect(screen.getByText("You already saved this link!")).toBeDefined();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  test("keeps the typed link after a duplicate, so it can be fixed", () => {
    render(<Home />);

    addLink("https://example.com");
    addLink("https://example.com");

    const input = screen.getByPlaceholderText("Paste a link...") as HTMLInputElement;
    expect(input.value).toBe("https://example.com");
  });

  test("hides the error when the link is changed", () => {
    render(<Home />);
    addLink("https://example.com");
    addLink("https://example.com");
    expect(screen.getByRole("alert")).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText("Paste a link..."), {
      target: { value: "https://example.com/other" },
    });

    expect(screen.queryByRole("alert")).toBeNull();
  });
  test("shows tags on the card", () => {
    render(<Home />);

    addLink("https://example.com", "", "react, news");

    const tags = screen.getByRole("list", { name: "Tags" });
    expect(within(tags).getAllByRole("listitem").map((tag) => tag.textContent)).toEqual([
      "#react",
      "#news",
    ]);
  });

  test("shows no tag list for a link without tags", () => {
    render(<Home />);

    addLink("https://example.com");

    expect(screen.queryByRole("list", { name: "Tags" })).toBeNull();
  });

  test("still shows links saved before tags existed", () => {
    saveLinks([{ id: "old", url: "https://example.com", createdAt: "2026-10-01T12:00:00.000Z" }]);

    render(<Home />);

    expect(screen.getByRole("link", { name: "example.com" })).toBeDefined();
  });

  test("shows only links with the clicked tag", () => {
    render(<Home />);
    addLink("https://react.dev", "", "react");
    addLink("https://news.ycombinator.com", "", "news");

    fireEvent.click(screen.getByRole("button", { name: "#react" }));

    expect(screen.getByRole("link", { name: "react.dev" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "news.ycombinator.com" })).toBeNull();
    expect(screen.getByText("Showing links tagged #react")).toBeDefined();
  });

  test("shows every link again after Show all", () => {
    render(<Home />);
    addLink("https://react.dev", "", "react");
    addLink("https://news.ycombinator.com", "", "news");

    fireEvent.click(screen.getByRole("button", { name: "#react" }));
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));

    expect(screen.getByRole("link", { name: "news.ycombinator.com" })).toBeDefined();
    expect(screen.queryByText("Showing links tagged #react")).toBeNull();
  });

});

  describe("editing a title", () => {
    function editTitle(newTitle: string) {
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
        target: { value: newTitle },
      });
    }

    test("changes the title of a link", () => {
      render(<Home />);
      addLink("https://example.com", "Old title");

      editTitle("New title");
      fireEvent.click(screen.getAllByRole("button", { name: "Save" })[1]);

      expect(screen.getByRole("link", { name: "New title" })).toBeDefined();
      expect(screen.queryByRole("link", { name: "Old title" })).toBeNull();
    });

    test("keeps the new title after a page refresh", () => {
      render(<Home />);
      addLink("https://example.com", "Old title");
      editTitle("New title");
      fireEvent.click(screen.getAllByRole("button", { name: "Save" })[1]);

      cleanup();
      render(<Home />);
      expect(screen.getByRole("link", { name: "New title" })).toBeDefined();
    });

    test("falls back to the domain when the title is cleared", () => {
      render(<Home />);
      addLink("https://example.com", "Old title");

      editTitle("");
      fireEvent.click(screen.getAllByRole("button", { name: "Save" })[1]);

      expect(screen.getByRole("link", { name: "example.com" })).toBeDefined();
    });

    test("cancel keeps the old title", () => {
      render(<Home />);
      addLink("https://example.com", "Old title");

      editTitle("New title");
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.getByRole("link", { name: "Old title" })).toBeDefined();
    });
  });

  test("shows the site's favicon next to a link", () => {
    render(<Home />);
    addLink("https://example.com");

    const icon = document.querySelector("img");
    expect(icon?.getAttribute("src")).toBe(
      "https://www.google.com/s2/favicons?domain=example.com&sz=32"
    );
  });
