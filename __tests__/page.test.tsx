import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import LinkManager from "@/components/LinkManager";
import { removeLink, saveLink, saveTitle } from "@/app/actions";

vi.mock("@/app/actions", () => ({
  saveLink: vi.fn(async () => null),
  removeLink: vi.fn(async () => {}),
  saveTitle: vi.fn(async () => {}),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function addLink(url: string, title = "", tags = "") {
  fireEvent.change(screen.getByPlaceholderText("Paste a link..."), {
    target: { value: url },
  });
  fireEvent.change(screen.getByPlaceholderText("Title (optional)"), {
    target: { value: title },
  });
  fireEvent.change(screen.getByPlaceholderText("Tags, comma separated"), {
    target: { value: tags },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  });
}


test("clears the tags box after saving", async () => {
  render(<LinkManager initialLinks={[]} />);

  await addLink("https://example.com", "", "react");

  expect(screen.getByPlaceholderText("Tags, comma separated")).toHaveProperty("value", "");
});



describe("Home page", () => {
  test("shows a message when there are no links", () => {
    render(<LinkManager initialLinks={[]} />);

    expect(screen.getByText("No links yet. Add your first one above.")).toBeDefined();
  });

  test("adds a link to the list", async () => {
    render(<LinkManager initialLinks={[]} />);

    await addLink("https://example.com");

    expect(screen.getByRole("link", { name: "example.com" })).toBeDefined();
    expect(screen.queryByText("No links yet. Add your first one above.")).toBeNull();
  });

  test("ignores an empty link", async () => {
    render(<LinkManager initialLinks={[]} />);

    await addLink("   ");

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });



  test("deletes a link", async () => {
    render(<LinkManager initialLinks={[]} />);
    await addLink("https://example.com");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.queryByRole("link", { name: "example.com" })).toBeNull();
  });

  test("the link opens the full url", async () => {
    render(<LinkManager initialLinks={[]} />);

    await addLink("https://example.com/some/page", "My favourite site");

    const link = screen.getByRole("link", { name: "My favourite site" });
    expect(link.getAttribute("href")).toBe("https://example.com/some/page");
  });

  test("shows the title when one is given", async () => {
    render(<LinkManager initialLinks={[]} />);

    await addLink("https://example.com", "My favourite site");

    expect(screen.getByRole("link", { name: "My favourite site" })).toBeDefined();
  });


  test("does not save the same link twice", async () => {
    render(<LinkManager initialLinks={[]} />);

    await addLink("https://example.com");
    await addLink("https://example.com");

    expect(screen.getByText("You already saved this link!")).toBeDefined();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  test("keeps the typed link after a duplicate, so it can be fixed", async () => {
    render(<LinkManager initialLinks={[]} />);

    await addLink("https://example.com");
    await addLink("https://example.com");

    const input = screen.getByPlaceholderText("Paste a link...") as HTMLInputElement;
    expect(input.value).toBe("https://example.com");
  });

  test("hides the error when the link is changed", async () => {
    render(<LinkManager initialLinks={[]} />);
    await addLink("https://example.com");
    await addLink("https://example.com");
    expect(screen.getByRole("alert")).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText("Paste a link..."), {
      target: { value: "https://example.com/other" },
    });

    expect(screen.queryByRole("alert")).toBeNull();
  });
  test("shows tags on the card", async () => {
    render(<LinkManager initialLinks={[]} />);

    await addLink("https://example.com", "", "react, news");

    const tags = screen.getByRole("list", { name: "Tags" });
    expect(within(tags).getAllByRole("listitem").map((tag) => tag.textContent)).toEqual([
      "#react",
      "#news",
    ]);
  });

  test("shows no tag list for a link without tags", async () => {
    render(<LinkManager initialLinks={[]} />);

    await addLink("https://example.com");

    expect(screen.queryByRole("list", { name: "Tags" })).toBeNull();
  });

  test("shows how long ago a link was saved, counted from the given time", () => {
    render(
      <LinkManager
        initialLinks={[{ id: "1", url: "https://example.com", createdAt: "2020-01-01T12:00:00.000Z" }]}
        now={new Date("2020-01-04T12:00:00.000Z")}
      />
    );

    expect(screen.getByText("3 days ago")).toBeDefined();
  });

  test("shows the links it starts with", () => {
    render(
      <LinkManager
        initialLinks={[{ id: "1", url: "https://example.com", createdAt: "2026-10-01T12:00:00.000Z" }]}
      />
    );

    expect(screen.getByRole("link", { name: "example.com" })).toBeDefined();
  });

  test("shows only links with the clicked tag", async () => {
    render(<LinkManager initialLinks={[]} />);
    await addLink("https://react.dev", "", "react");
    await addLink("https://news.ycombinator.com", "", "news");

    fireEvent.click(screen.getByRole("button", { name: "#react" }));

    expect(screen.getByRole("link", { name: "react.dev" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "news.ycombinator.com" })).toBeNull();
    expect(screen.getByText("Showing links tagged #react")).toBeDefined();
  });

  test("shows every link again after Show all", async () => {
    render(<LinkManager initialLinks={[]} />);
    await addLink("https://react.dev", "", "react");
    await addLink("https://news.ycombinator.com", "", "news");

    fireEvent.click(screen.getByRole("button", { name: "#react" }));
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));

    expect(screen.getByRole("link", { name: "news.ycombinator.com" })).toBeDefined();
    expect(screen.queryByText("Showing links tagged #react")).toBeNull();
  });


  test("shows only links that match the search", async () => {
    render(<LinkManager initialLinks={[]} />);
    await addLink("https://react.dev", "React docs");
    await addLink("https://news.ycombinator.com");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search links" }), {
      target: { value: "react" },
    });

    expect(screen.getByRole("link", { name: "React docs" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "news.ycombinator.com" })).toBeNull();
  });

  test("shows a message when nothing matches the search", async () => {
    render(<LinkManager initialLinks={[]} />);
    await addLink("https://react.dev");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search links" }), {
      target: { value: "vue" },
    });

    expect(screen.getByText("No links match your search.")).toBeDefined();
    expect(screen.queryByText("No links yet. Add your first one above.")).toBeNull();
  });

  test("searches only inside the chosen tag", async () => {
    render(<LinkManager initialLinks={[]} />);
    await addLink("https://react.dev", "", "docs");
    await addLink("https://vuejs.org", "", "docs");
    await addLink("https://reactjs.org/blog", "", "news");

    fireEvent.click(screen.getAllByRole("button", { name: "#docs" })[0]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search links" }), {
      target: { value: "react" },
    });

    expect(screen.getByRole("link", { name: "react.dev" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "vuejs.org" })).toBeNull();
    expect(screen.queryByRole("link", { name: "reactjs.org" })).toBeNull();
  });
  test("clicking the chosen tag again shows every link", async () => {
    render(<LinkManager initialLinks={[]} />);
    await addLink("https://react.dev", "", "react");
    await addLink("https://news.ycombinator.com", "", "news");

    fireEvent.click(screen.getByRole("button", { name: "#react" }));
    fireEvent.click(screen.getByRole("button", { name: "#react" }));

    expect(screen.getByRole("link", { name: "news.ycombinator.com" })).toBeDefined();
    expect(screen.queryByText("Showing links tagged #react")).toBeNull();
  });

  test("marks the chosen tag as pressed", async () => {
    render(<LinkManager initialLinks={[]} />);
    await addLink("https://react.dev", "", "react, docs");

    fireEvent.click(screen.getByRole("button", { name: "#react" }));

    expect(screen.getByRole("button", { name: "#react", pressed: true })).toBeDefined();
    expect(screen.getByRole("button", { name: "#docs", pressed: false })).toBeDefined();
  });



  test("shows the newest link first", async () => {
    render(<LinkManager initialLinks={[]} />);
    await addLink("https://first.com");
    await addLink("https://second.com");

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "second.com",
      "first.com",
    ]);
  });

  test("sorts links by title", async () => {
    render(<LinkManager initialLinks={[]} />);
    await addLink("https://zebra.com");
    await addLink("https://apple.com");
    await addLink("https://mango.com");

    fireEvent.change(screen.getByRole("combobox", { name: "Sort links" }), {
      target: { value: "title" },
    });

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "apple.com",
      "mango.com",
      "zebra.com",
    ]);
  });
});

describe("editing a title", () => {
  function editTitle(newTitle: string) {
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: newTitle },
    });
  }

  test("changes the title of a link", async () => {
    render(<LinkManager initialLinks={[]} />);
    await addLink("https://example.com", "Old title");

    editTitle("New title");
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[1]);

    expect(screen.getByRole("link", { name: "New title" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Old title" })).toBeNull();
  });


  test("falls back to the domain when the title is cleared", async () => {
    render(<LinkManager initialLinks={[]} />);
    await addLink("https://example.com", "Old title");

    editTitle("");
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[1]);

    expect(screen.getByRole("link", { name: "example.com" })).toBeDefined();
  });

  test("cancel keeps the old title", async () => {
    render(<LinkManager initialLinks={[]} />);
    await addLink("https://example.com", "Old title");

    editTitle("New title");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("link", { name: "Old title" })).toBeDefined();
  });
});

test("shows the site's favicon next to a link", async () => {
  render(<LinkManager initialLinks={[]} />);
  await addLink("https://example.com");

  const icon = document.querySelector("img");
  expect(icon?.getAttribute("src")).toBe(
    "https://www.google.com/s2/favicons?domain=example.com&sz=32"
  );
});

describe("saving to the database", () => {
  const saved = { id: "1", url: "https://example.com", title: "Old title", createdAt: "2026-10-01T12:00:00.000Z" };

  test("sends a new link to the server", async () => {
    render(<LinkManager initialLinks={[]} />);

    await addLink("https://example.com", "Example", "React, news");

    expect(saveLink).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com", title: "Example", tags: ["react", "news"] })
    );
  });

  test("shows the server's error and does not add the link", async () => {
    vi.mocked(saveLink).mockResolvedValueOnce("You already saved this link!");
    render(<LinkManager initialLinks={[]} />);

    await addLink("https://example.com");

    expect(screen.getByRole("alert").textContent).toBe("You already saved this link!");
    expect(screen.queryByRole("link", { name: "example.com" })).toBeNull();
  });

  test("tells the server to delete a link", async () => {
    render(<LinkManager initialLinks={[saved]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });

    expect(removeLink).toHaveBeenCalledWith("1");
  });

  test("sends an edited title to the server", async () => {
    render(<LinkManager initialLinks={[saved]} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "New title" },
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Save" })[1]);
    });

    expect(saveTitle).toHaveBeenCalledWith("1", "New title");
  });
});
