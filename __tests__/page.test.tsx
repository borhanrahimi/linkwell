import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import LinkManager from "@/components/LinkManager";
import { checkAllLinks, createFolder, deleteFolder, moveToFolder, renameFolder, setFolderColor, setFolderIcon, removeLink, saveLink, saveReadStatus, saveLinkDetails } from "@/app/actions";
import { STORAGE_KEY } from "@/lib/links";
import type { Link } from "@/types/link";

// The top bar's Sign out button uses the router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/app/actions", () => ({
  checkAllLinks: vi.fn(async () => []),
  createFolder: vi.fn(async (name: string) => ({ id: "f1", name })),
  moveToFolder: vi.fn(async () => {}),
  renameFolder: vi.fn(async () => null),
  setFolderColor: vi.fn(async () => {}),
  setFolderIcon: vi.fn(async () => {}),
  deleteFolder: vi.fn(async () => {}),
  importLinks: vi.fn(async (links) => links),
  saveLink: vi.fn(async (link) => link),
  removeLink: vi.fn(async () => { }),
  // Like the real action: returns the cleaned details.
  saveLinkDetails: vi.fn(async (_id: string, input: { title: string; tags: string; note: string }) => ({
    title: input.title.trim() || undefined,
    tags: input.tags.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean),
    note: input.note.trim() || undefined,
  })),
  saveReadStatus: vi.fn(async () => {}),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

// How many link cards are showing (the sidebar has list items too).
function cardCount() {
  const list = screen.queryByRole("list", { name: "Links" });
  return list ? list.children.length : 0;
}

// The list of link cards.
function cards() {
  return within(screen.getByRole("list", { name: "Links" }));
}

async function addLink(url: string, title = "", tags = "") {
  fireEvent.change(screen.getByPlaceholderText("Paste a link..."), {
    target: { value: url },
  });
  // Title and tags only appear once the link box has a link in it.
  if (title || tags) {
    fireEvent.change(screen.getByPlaceholderText("Title (optional)"), {
      target: { value: title },
    });
    fireEvent.change(screen.getByPlaceholderText("Tags, comma separated"), {
      target: { value: tags },
    });
  }
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  });
}


test("clears the tags box after saving", async () => {
  render(<LinkManager initialLinks={[]} />);

  await addLink("https://example.com", "", "react");
  // The details row hides with the empty link box, and comes back empty.
  expect(screen.queryByPlaceholderText("Tags, comma separated")).toBeNull();
  fireEvent.change(screen.getByPlaceholderText("Paste a link..."), { target: { value: "https://next.com" } });

  expect(screen.getByPlaceholderText("Tags, comma separated")).toHaveProperty("value", "");
});

test("shows title and tags only once a link is typed", () => {
  render(<LinkManager initialLinks={[]} />);

  expect(screen.queryByPlaceholderText("Title (optional)")).toBeNull();
  fireEvent.change(screen.getByPlaceholderText("Paste a link..."), { target: { value: "https://example.com" } });

  expect(screen.getByPlaceholderText("Title (optional)")).toBeDefined();
});

test("puts the save box in the top bar, next to the account", () => {
  render(<LinkManager initialLinks={[]} user={{ name: "Ada", username: "ada" }} />);

  const bar = screen.getByRole("banner");
  expect(within(bar).getByPlaceholderText("Paste a link...")).toBeDefined();
  expect(within(bar).getByRole("link", { name: "@ada" })).toBeDefined();
});



describe("Home page", () => {
  test("shows a message when there are no links", () => {
    render(<LinkManager initialLinks={[]} />);

    expect(screen.getByText("No links yet. Add your first one above.")).toBeDefined();
    // With a drawing that screen readers skip.
    expect(document.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
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

    expect(cardCount()).toBe(0);
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
    expect(cardCount()).toBe(1);
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

describe("editing a link", () => {
  function editTitle(newTitle: string) {
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: newTitle },
    });
  }

  async function saveEdit() {
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Save" })[1]);
    });
  }

  test("fills the form with the link's title, tags and note", () => {
    render(
      <LinkManager initialLinks={[{ id: "1", url: "https://react.dev", title: "React", tags: ["react", "docs"], note: "Hooks", createdAt: "2020-01-01T00:00:00.000Z" }]} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("textbox", { name: "Title" })).toHaveProperty("value", "React");
    expect(screen.getByRole("textbox", { name: "Tags" })).toHaveProperty("value", "react, docs");
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveProperty("value", "Hooks");
  });

  test("changes and removes tags", async () => {
    render(<LinkManager initialLinks={[]} />);
    await addLink("https://example.com", "Example", "old, keep");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Tags" }), { target: { value: "keep, New" } });
    await saveEdit();

    expect(screen.queryByRole("button", { name: "#old" })).toBeNull();
    expect(screen.getByRole("button", { name: "#keep" })).toBeDefined();
    expect(screen.getByRole("button", { name: "#new" })).toBeDefined();
  });

  test("adds a note that shows on the card and can be searched", async () => {
    render(<LinkManager initialLinks={[]} />);
    await addLink("https://example.com", "Example");
    await addLink("https://other.com", "Other");

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[1]);
    fireEvent.change(screen.getByRole("textbox", { name: "Note" }), { target: { value: "For the interview" } });
    await saveEdit();

    expect(screen.getByText("For the interview")).toBeDefined();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search links" }), { target: { value: "interview" } });

    expect(screen.getByRole("link", { name: "Example" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Other" })).toBeNull();
  });

  test("changes the title of a link", async () => {
    render(<LinkManager initialLinks={[]} />);
    await addLink("https://example.com", "Old title");

    editTitle("New title");
    await saveEdit();

    expect(screen.getByRole("link", { name: "New title" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Old title" })).toBeNull();
  });


  test("falls back to the domain when the title is cleared", async () => {
    render(<LinkManager initialLinks={[]} />);
    await addLink("https://example.com", "Old title");

    editTitle("");
    await saveEdit();

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
    "https://www.google.com/s2/favicons?domain=example.com&sz=64"
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

  test("shows the title the server found", async () => {
    vi.mocked(saveLink).mockImplementationOnce(async (link) => ({ ...link, title: "Example Domain" }));
    render(<LinkManager initialLinks={[]} />);

    await addLink("https://example.com");

    expect(screen.getByRole("link", { name: "Example Domain" })).toBeDefined();
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

  test("sends the edited details to the server", async () => {
    render(<LinkManager initialLinks={[saved]} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "New title" },
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Save" })[1]);
    });

    expect(saveLinkDetails).toHaveBeenCalledWith("1", { title: "New title", tags: "", note: "" });
  });
});

describe("typing while a link is saving", () => {
  test("keeps the next link you started typing", async () => {
    // Hold the save open, like a slow server that is still fetching the title.
    let finishSaving: (link: Link) => void = () => {};
    vi.mocked(saveLink).mockImplementationOnce(
      (link) => new Promise((resolve) => (finishSaving = () => resolve(link)))
    );
    render(<LinkManager initialLinks={[]} />);

    fireEvent.change(screen.getByPlaceholderText("Paste a link..."), { target: { value: "https://first.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.change(screen.getByPlaceholderText("Paste a link..."), { target: { value: "https://second.com" } });
    await act(async () => finishSaving({ id: "x", url: "https://first.com", createdAt: "2020-01-01T00:00:00.000Z" }));

    expect(screen.getByPlaceholderText("Paste a link...")).toHaveProperty("value", "https://second.com");
  });
});

describe("importing links saved in this browser", () => {
  const old = { id: "old", url: "https://old.com", createdAt: "2026-01-01T00:00:00.000Z" };

  test("offers to import links saved in this browser", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([old]));
    render(<LinkManager initialLinks={[]} />);

    expect(screen.getByText(/You have 1 link saved in this browser/)).toBeDefined();
  });

  test("shows nothing when there is nothing to import", () => {
    render(<LinkManager initialLinks={[]} />);

    expect(screen.queryByRole("button", { name: "Import" })).toBeNull();
  });

  test("imports the links, shows them and clears the browser's copy", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([old]));
    render(<LinkManager initialLinks={[]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Import" }));
    });

    expect(screen.getByRole("link", { name: "old.com" })).toBeDefined();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.queryByRole("button", { name: "Import" })).toBeNull();
  });

  test("Not now hides the offer but keeps the links in the browser", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([old]));
    render(<LinkManager initialLinks={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(screen.queryByRole("button", { name: "Import" })).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });
});

describe("sidebar", () => {
  const links = [
    { id: "1", url: "https://a.com", title: "A", createdAt: "2020-01-01T00:00:00.000Z", tags: ["react"], folderId: "f1" },
    { id: "2", url: "https://b.com", title: "B", createdAt: "2020-01-01T00:00:00.000Z", readAt: "2020-01-02T00:00:00.000Z", tags: ["react", "news"] },
    { id: "3", url: "https://c.com", title: "C", createdAt: "2020-01-01T00:00:00.000Z", status: "broken" as const },
  ];
  const folders = [{ id: "f1", name: "Work" }];
  const sidebar = () => within(screen.getByRole("navigation", { name: "Your lists" }));
  const shownTitles = () => cards().getAllByRole("link").map((link) => link.textContent).filter((text) => /^[ABC]$/.test(text ?? "")).sort();

  test("counts all, unread and broken links, and the links in each folder and tag", () => {
    render(<LinkManager initialLinks={links} initialFolders={folders} />);

    expect(sidebar().getByRole("button", { name: "All links" }).textContent).toContain("3");
    expect(sidebar().getByRole("button", { name: "Unread" }).textContent).toContain("2");
    expect(sidebar().getByRole("button", { name: "Broken" }).textContent).toContain("1");
    expect(sidebar().getByRole("button", { name: "Work" }).textContent).toContain("1");
    // Tags: most used first.
    expect(within(sidebar().getByRole("list", { name: "All tags" })).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "#react2",
      "#news1",
    ]);
  });

  test("Unread and Broken filter the list, and the heading says which list it is", () => {
    render(<LinkManager initialLinks={links} initialFolders={folders} />);

    fireEvent.click(sidebar().getByRole("button", { name: "Unread" }));
    expect(screen.getByRole("heading", { level: 2, name: "Unread" })).toBeDefined();
    expect(shownTitles()).toEqual(["A", "C"]);

    fireEvent.click(sidebar().getByRole("button", { name: "Broken" }));
    expect(shownTitles()).toEqual(["C"]);
  });

  test("picking a folder leaves the smart list, and picking a list leaves the folder", () => {
    render(<LinkManager initialLinks={links} initialFolders={folders} />);

    fireEvent.click(sidebar().getByRole("button", { name: "Broken" }));
    fireEvent.click(sidebar().getByRole("button", { name: "Work" }));
    expect(shownTitles()).toEqual(["A"]);
    expect(sidebar().getByRole("button", { name: "Broken", pressed: false })).toBeDefined();

    fireEvent.click(sidebar().getByRole("button", { name: "All links" }));
    expect(shownTitles()).toEqual(["A", "B", "C"]);
    expect(sidebar().getByRole("button", { name: "Work", pressed: false })).toBeDefined();
  });

  test("a tag in the sidebar filters the list, and works together with a smart list", () => {
    render(<LinkManager initialLinks={links} initialFolders={folders} />);

    fireEvent.click(sidebar().getByRole("button", { name: "react" }));
    expect(shownTitles()).toEqual(["A", "B"]);

    fireEvent.click(sidebar().getByRole("button", { name: "Unread" }));
    expect(shownTitles()).toEqual(["A"]);
  });

  test("says so when there's nothing unread", () => {
    render(<LinkManager initialLinks={[links[1]]} />);

    fireEvent.click(sidebar().getByRole("button", { name: "Unread" }));

    expect(screen.getByText("Nothing unread. You're all caught up.")).toBeDefined();
  });
});

describe("checking links", () => {
  const working = { id: "1", url: "https://working.com", createdAt: "2026-10-01T12:00:00.000Z" };
  const dead = { id: "2", url: "https://dead.com", createdAt: "2026-10-02T12:00:00.000Z" };

  test("says so when links were checked too often, and keeps the cards as they are", async () => {
    vi.mocked(checkAllLinks).mockResolvedValueOnce("You're going a bit fast. Please wait a moment and try again.");
    render(<LinkManager initialLinks={[working]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Check links" }));
    });

    expect(screen.getByRole("status").textContent).toBe("You're going a bit fast. Please wait a moment and try again.");
    expect(screen.getByRole("link", { name: "working.com" })).toBeDefined();
  });

  test("has no Check links button when there are no links", () => {
    render(<LinkManager initialLinks={[]} />);

    expect(screen.queryByRole("button", { name: "Check links" })).toBeNull();
  });

  test("checks the links and says how many are broken", async () => {
    vi.mocked(checkAllLinks).mockResolvedValueOnce([
      { ...working, status: "ok" },
      { ...dead, status: "broken" },
    ]);
    render(<LinkManager initialLinks={[working, dead]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Check links" }));
    });

    expect(checkAllLinks).toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("Checked 2 links: 1 broken.");
  });

  test("says when every link works", async () => {
    vi.mocked(checkAllLinks).mockResolvedValueOnce([{ ...working, status: "ok" }]);
    render(<LinkManager initialLinks={[working]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Check links" }));
    });

    expect(screen.getByRole("status").textContent).toBe("Checked 1 link: all working.");
  });
});

describe("broken badge", () => {
  const base = { id: "1", url: "https://example.com", createdAt: "2026-10-01T12:00:00.000Z" };

  test("shows a Broken badge on a broken link", () => {
    render(<LinkManager initialLinks={[{ ...base, status: "broken", checkedAt: "2026-10-07T12:00:00.000Z" }]} />);

    expect(cards().getByText("Broken")).toBeDefined();
    // The snapped-chain doodle is decoration, hidden from screen readers.
    expect(cards().getByText("Broken").querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  test("shows no badge on a working link", () => {
    render(<LinkManager initialLinks={[{ ...base, status: "ok" }]} />);

    expect(cards().queryByText("Broken")).toBeNull();
  });

  test("shows no badge on a link that was never checked", () => {
    render(<LinkManager initialLinks={[base]} />);

    expect(cards().queryByText("Broken")).toBeNull();
  });
  test("offers an archived copy of a broken link", () => {
    render(<LinkManager initialLinks={[{ ...base, status: "broken" }]} />);

    const archive = screen.getByRole("link", { name: "View archived copy" });
    expect(archive.getAttribute("href")).toBe("https://web.archive.org/web/https://example.com");
  });

  test("offers no archived copy for a working link", () => {
    render(<LinkManager initialLinks={[{ ...base, status: "ok" }]} />);

    expect(screen.queryByRole("link", { name: "View archived copy" })).toBeNull();
  });



  test("says when the link was checked", () => {
    render(
      <LinkManager
        initialLinks={[{ ...base, status: "broken", checkedAt: "2020-01-01T12:00:00.000Z" }]}
        now={new Date("2020-01-03T12:00:00.000Z")}
      />
    );

    expect(cards().getByText("Broken").getAttribute("title")).toBe("Checked 2 days ago");
  });
});

describe("read and unread", () => {
  const unread = { id: "1", url: "https://example.com", createdAt: "2026-10-01T12:00:00.000Z" };

  test("marks a link as read", async () => {
    render(<LinkManager initialLinks={[unread]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    });

    expect(screen.getByRole("button", { name: "Mark unread" })).toBeDefined();
    expect(saveReadStatus).toHaveBeenCalledWith("1", true);
    // A "Read" label with a hand-drawn tick that screen readers skip.
    expect(screen.getByText("Read").querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  test("marks a read link as unread again", async () => {
    render(<LinkManager initialLinks={[{ ...unread, readAt: "2026-10-08T09:00:00.000Z" }]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark unread" }));
    });

    expect(screen.getByRole("button", { name: "Mark read" })).toBeDefined();
    expect(saveReadStatus).toHaveBeenCalledWith("1", false);
  });
});

describe("rediscover", () => {
  const now = new Date("2026-10-20T12:00:00.000Z");
  const old = { id: "1", url: "https://old.com", title: "Old article", createdAt: "2026-09-29T12:00:00.000Z" };
  const recent = { id: "2", url: "https://recent.com", createdAt: "2026-10-19T12:00:00.000Z" };

  test("brings back an old unread link", () => {
    render(<LinkManager initialLinks={[old, recent]} now={now} />);

    const section = screen.getByRole("region", { name: "Rediscover" });
    expect(within(section).getByRole("link", { name: "Old article" })).toBeDefined();
    expect(within(section).getByText("saved 3 weeks ago")).toBeDefined();
    expect(within(section).queryByRole("link", { name: "recent.com" })).toBeNull();
  });

  test("asks \"Remember these?\" next to a drawing that screen readers skip", () => {
    render(<LinkManager initialLinks={[old]} now={now} />);

    const section = screen.getByRole("region", { name: "Rediscover" });
    expect(within(section).getByText(/^Remember these\?/)).toBeDefined();
    expect(section.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  test("is hidden when there is nothing to rediscover", () => {
    render(<LinkManager initialLinks={[recent]} now={now} />);

    expect(screen.queryByRole("region", { name: "Rediscover" })).toBeNull();
  });

  test("lets go of a link once it is marked as read", async () => {
    render(<LinkManager initialLinks={[old]} now={now} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    });

    expect(screen.queryByRole("region", { name: "Rediscover" })).toBeNull();
  });
});

describe("folders", () => {
  function createFolderNamed(name: string) {
    fireEvent.click(screen.getByRole("button", { name: "+ New folder" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Folder name" }), {
      target: { value: name },
    });
    return act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create" }));
    });
  }

  test("shows the folders it starts with", () => {
    render(<LinkManager initialLinks={[]} initialFolders={[{ id: "f1", name: "Work" }]} />);

    const list = screen.getByRole("list", { name: "Folders" });
    expect(within(list).getByText("Work")).toBeDefined();
  });

  test("creates a new folder", async () => {
    render(<LinkManager initialLinks={[]} />);

    await createFolderNamed("Recipes");

    expect(createFolder).toHaveBeenCalledWith("Recipes");
    expect(within(screen.getByRole("list", { name: "Folders" })).getByText("Recipes")).toBeDefined();
    expect(screen.queryByRole("textbox", { name: "Folder name" })).toBeNull();
  });

  test("shows the server's error and keeps the form open", async () => {
    vi.mocked(createFolder).mockResolvedValueOnce('You already have a folder called "Work".');
    render(<LinkManager initialLinks={[]} initialFolders={[{ id: "f1", name: "Work" }]} />);

    await createFolderNamed("Work");

    expect(screen.getByRole("alert").textContent).toBe('You already have a folder called "Work".');
    expect(screen.getByRole("textbox", { name: "Folder name" })).toBeDefined();
  });

  test("Cancel closes the form without creating anything", () => {
    render(<LinkManager initialLinks={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "+ New folder" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("textbox", { name: "Folder name" })).toBeNull();
    expect(createFolder).not.toHaveBeenCalled();
  });
});

describe("moving links into folders", () => {
  const link = { id: "1", url: "https://example.com", createdAt: "2026-10-01T12:00:00.000Z" };
  const work = { id: "f1", name: "Work" };

  test("has no folder picker when there are no folders", () => {
    render(<LinkManager initialLinks={[link]} />);

    expect(screen.queryByRole("combobox", { name: "Folder" })).toBeNull();
  });

  test("moves a link into a folder", async () => {
    render(<LinkManager initialLinks={[link]} initialFolders={[work]} />);

    await act(async () => {
      fireEvent.change(screen.getByRole("combobox", { name: "Folder" }), { target: { value: "f1" } });
    });

    expect(screen.getByRole("combobox", { name: "Folder" })).toHaveProperty("value", "f1");
    expect(moveToFolder).toHaveBeenCalledWith("1", "f1");
  });

  test("takes a link out of its folder", async () => {
    render(<LinkManager initialLinks={[{ ...link, folderId: "f1" }]} initialFolders={[work]} />);

    await act(async () => {
      fireEvent.change(screen.getByRole("combobox", { name: "Folder" }), { target: { value: "" } });
    });

    expect(screen.getByRole("combobox", { name: "Folder" })).toHaveProperty("value", "");
    expect(moveToFolder).toHaveBeenCalledWith("1", null);
  });
});

describe("showing one folder", () => {
  const work = { id: "f1", name: "Work" };
  const recipes = { id: "f2", name: "Recipes" };
  const github = { id: "1", url: "https://github.com", createdAt: "2026-10-01T12:00:00.000Z", folderId: "f1" };
  const react = { id: "2", url: "https://react.dev", createdAt: "2026-10-02T12:00:00.000Z" };

  test("shows only the links in the clicked folder", () => {
    render(<LinkManager initialLinks={[github, react]} initialFolders={[work]} />);

    fireEvent.click(screen.getByRole("button", { name: "Work" }));

    expect(screen.getByRole("link", { name: "github.com" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "react.dev" })).toBeNull();
    expect(screen.getByRole("button", { name: "Work", pressed: true })).toBeDefined();
  });

  test("All links shows every link again", () => {
    render(<LinkManager initialLinks={[github, react]} initialFolders={[work]} />);

    fireEvent.click(screen.getByRole("button", { name: "Work" }));
    fireEvent.click(screen.getByRole("button", { name: "All links" }));

    expect(screen.getByRole("link", { name: "react.dev" })).toBeDefined();
    expect(screen.getByRole("button", { name: "All links", pressed: true })).toBeDefined();
  });

  test("clicking the chosen folder again shows every link", () => {
    render(<LinkManager initialLinks={[github, react]} initialFolders={[work]} />);

    fireEvent.click(screen.getByRole("button", { name: "Work" }));
    fireEvent.click(screen.getByRole("button", { name: "Work" }));

    expect(screen.getByRole("link", { name: "react.dev" })).toBeDefined();
  });

  test("says when a folder is empty", () => {
    render(<LinkManager initialLinks={[github, react]} initialFolders={[work, recipes]} />);

    fireEvent.click(screen.getByRole("button", { name: "Recipes" }));

    expect(screen.getByText("No links in this folder yet.")).toBeDefined();
  });
});

describe("renaming and deleting folders", () => {
  const work = { id: "f1", name: "Work" };
  const github = { id: "1", url: "https://github.com", createdAt: "2026-10-01T12:00:00.000Z", folderId: "f1" };

  function openWork() {
    render(<LinkManager initialLinks={[github]} initialFolders={[work]} />);
    fireEvent.click(screen.getByRole("button", { name: "Work" }));
  }

  test("only offers rename and delete when a folder is selected", () => {
    render(<LinkManager initialLinks={[github]} initialFolders={[work]} />);

    expect(screen.queryByRole("button", { name: "Rename folder" })).toBeNull();
  });

  test("renames the selected folder", async () => {
    openWork();

    fireEvent.click(screen.getByRole("button", { name: "Rename folder" }));
    fireEvent.change(screen.getByRole("textbox", { name: "New folder name" }), { target: { value: "Job" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    });

    expect(renameFolder).toHaveBeenCalledWith("f1", "Job");
    expect(screen.getByRole("button", { name: "Job" })).toBeDefined();
  });

  test("shows the server's error when renaming fails", async () => {
    vi.mocked(renameFolder).mockResolvedValueOnce('You already have a folder called "Recipes".');
    openWork();

    fireEvent.click(screen.getByRole("button", { name: "Rename folder" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    });

    expect(screen.getByRole("alert").textContent).toBe('You already have a folder called "Recipes".');
  });

  test("deletes the folder after asking, and keeps its links", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    openWork();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete folder" }));
    });

    expect(deleteFolder).toHaveBeenCalledWith("f1");
    expect(screen.queryByRole("button", { name: "Work" })).toBeNull();
    expect(screen.getByRole("link", { name: "github.com" })).toBeDefined();
  });

  test("does nothing when you cancel the delete", () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    openWork();

    fireEvent.click(screen.getByRole("button", { name: "Delete folder" }));

    expect(deleteFolder).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Work" })).toBeDefined();
  });
});


describe("paste button", () => {
  function fakeClipboard(readText: () => Promise<string>) {
    Object.defineProperty(navigator, "clipboard", { value: { readText }, configurable: true });
  }

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  });

  async function clickPaste() {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Paste" }));
    });
  }

  test("is hidden when the browser can't read the clipboard", () => {
    render(<LinkManager initialLinks={[]} />);

    expect(screen.queryByRole("button", { name: "Paste" })).toBeNull();
  });

  test("fills in the link from the clipboard", async () => {
    fakeClipboard(async () => "Look at this https://example.com/pasted");
    render(<LinkManager initialLinks={[]} />);

    await clickPaste();

    expect(screen.getByPlaceholderText("Paste a link...")).toHaveProperty("value", "https://example.com/pasted");
    expect(saveLink).not.toHaveBeenCalled();
  });

  test("says so when the clipboard has no link", async () => {
    fakeClipboard(async () => "just some words");
    render(<LinkManager initialLinks={[]} />);

    await clickPaste();

    expect(screen.getByRole("alert").textContent).toBe("There's no link on your clipboard.");
    expect(screen.getByPlaceholderText("Paste a link...")).toHaveProperty("value", "");
  });

  test("explains when the browser says no", async () => {
    fakeClipboard(async () => {
      throw new DOMException("Denied", "NotAllowedError");
    });
    render(<LinkManager initialLinks={[]} />);

    await clickPaste();

    expect(screen.getByRole("alert").textContent).toMatch(/can't read your clipboard/);
  });
});


describe("folder colours", () => {
  const work = { id: "f1", name: "Work", color: "green" as const };

  function dotOf(name: string) {
    return screen.getByRole("button", { name }).querySelector("span");
  }

  test("each folder pill shows its colour, and gray when it has none", () => {
    render(<LinkManager initialLinks={[]} initialFolders={[work, { id: "f2", name: "Old" }]} />);

    expect(dotOf("Work")?.className).toContain("bg-folder-green");
    expect(dotOf("Old")?.className).toContain("bg-folder-gray");
  });

  test("picking a colour changes the pill at once and saves it", async () => {
    render(<LinkManager initialLinks={[]} initialFolders={[work]} />);
    fireEvent.click(screen.getByRole("button", { name: "Work" }));
    const colours = screen.getByRole("group", { name: "Folder colour" });

    expect(within(colours).getByRole("button", { name: "Green", pressed: true })).toBeDefined();
    await act(async () => {
      fireEvent.click(within(colours).getByRole("button", { name: "Purple" }));
    });

    expect(setFolderColor).toHaveBeenCalledWith("f1", "purple");
    expect(dotOf("Work")?.className).toContain("bg-folder-purple");
    expect(within(colours).getByRole("button", { name: "Purple", pressed: true })).toBeDefined();
  });
});

describe("folder icons", () => {
  const work = { id: "f1", name: "Work", color: "blue" as const };

  test("picking an icon draws it on the pill in the folder's colour, and Dot takes it away", async () => {
    render(<LinkManager initialLinks={[]} initialFolders={[work]} />);
    fireEvent.click(screen.getByRole("button", { name: "Work" }));
    const icons = screen.getByRole("group", { name: "Folder icon" });

    expect(within(icons).getByRole("button", { name: "Dot", pressed: true })).toBeDefined();
    await act(async () => {
      fireEvent.click(within(icons).getByRole("button", { name: "Coffee icon" }));
    });

    expect(setFolderIcon).toHaveBeenCalledWith("f1", "coffee");
    const pill = screen.getByRole("button", { name: "Work" });
    expect(pill.querySelector("svg")?.getAttribute("class")).toContain("text-folder-blue");

    await act(async () => {
      fireEvent.click(within(icons).getByRole("button", { name: "Dot" }));
    });

    expect(setFolderIcon).toHaveBeenLastCalledWith("f1", null);
    expect(screen.getByRole("button", { name: "Work" }).querySelector("svg")).toBeNull();
  });
});


describe("views", () => {
  const links = [
    { id: "1", url: "https://react.dev", title: "React", tags: ["react"], note: "Hooks", createdAt: "2020-01-01T00:00:00.000Z" },
    { id: "2", url: "https://nextjs.org", title: "Next", createdAt: "2020-01-02T00:00:00.000Z", status: "broken" as const },
  ];
  const views = () => within(screen.getByRole("group", { name: "View" }));

  test("starts with cards, and List shows one compact row per link", () => {
    render(<LinkManager initialLinks={links} />);
    expect(views().getByRole("button", { name: "Cards", pressed: true })).toBeDefined();
    expect(screen.getByText("Hooks")).toBeDefined();

    fireEvent.click(views().getByRole("button", { name: "List" }));

    expect(views().getByRole("button", { name: "List", pressed: true })).toBeDefined();
    expect(cardCount()).toBe(2);
    // Rows keep the title, the badges, the tags and the actions, but not the note.
    expect(cards().getByRole("link", { name: "React" })).toBeDefined();
    expect(cards().getByText("Broken")).toBeDefined();
    expect(cards().getByRole("button", { name: "#react" })).toBeDefined();
    expect(cards().getAllByRole("button", { name: "Mark read" })).toHaveLength(2);
    expect(screen.queryByText("Hooks")).toBeNull();
  });

  test("Edit works in a row too", async () => {
    render(<LinkManager initialLinks={links} />);
    fireEvent.click(views().getByRole("button", { name: "List" }));

    fireEvent.click(cards().getAllByRole("button", { name: "Edit" })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "React docs" } });
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Save" }).at(-1)!);
    });

    expect(cards().getByRole("link", { name: "React docs" })).toBeDefined();
  });

  test("remembers the view on this device", () => {
    const first = render(<LinkManager initialLinks={links} />);
    fireEvent.click(views().getByRole("button", { name: "List" }));
    first.unmount();

    render(<LinkManager initialLinks={links} />);

    expect(views().getByRole("button", { name: "List", pressed: true })).toBeDefined();
  });
});


describe("details panel", () => {
  const link = {
    id: "1",
    url: "https://react.dev/learn",
    title: "React",
    tags: ["react", "docs"],
    note: "For the interview",
    createdAt: "2020-01-01T00:00:00.000Z",
    checkedAt: "2020-02-01T12:00:00.000Z",
    status: "ok" as const,
    folderId: "f1",
  };
  const folders = [{ id: "f1", name: "Work" }, { id: "f2", name: "Reading" }];
  const panel = () => within(screen.getByRole("complementary", { name: "React" }));

  function open() {
    render(<LinkManager initialLinks={[link]} initialFolders={folders} />);
    fireEvent.click(cards().getByRole("button", { name: "Details" }));
  }

  test("shows everything about the link, and moves focus into it", () => {
    open();

    expect(panel().getByRole("link", { name: "https://react.dev/learn" })).toBeDefined();
    expect(panel().getByText("For the interview")).toBeDefined();
    expect(panel().getByText("Not yet")).toBeDefined();
    expect(panel().getByText(/February 1, 2020: working/)).toBeDefined();
    expect(panel().getByRole("combobox", { name: "Folder" })).toHaveProperty("value", "f1");
    expect(panel().getByRole("button", { name: "#docs" })).toBeDefined();
    expect(document.activeElement?.textContent).toBe("React");
  });

  test("changes the folder, the read status and the details from the panel", async () => {
    open();

    await act(async () => {
      fireEvent.change(panel().getByRole("combobox", { name: "Folder" }), { target: { value: "f2" } });
    });
    expect(moveToFolder).toHaveBeenCalledWith("1", "f2");

    await act(async () => {
      fireEvent.click(panel().getByRole("button", { name: "Mark read" }));
    });
    expect(panel().getByRole("button", { name: "Mark unread" })).toBeDefined();

    fireEvent.click(panel().getByRole("button", { name: "Edit" }));
    fireEvent.change(panel().getByRole("textbox", { name: "Note" }), { target: { value: "Read before Friday" } });
    await act(async () => {
      fireEvent.click(panel().getByRole("button", { name: "Save" }));
    });
    expect(saveLinkDetails).toHaveBeenCalledWith("1", { title: "React", tags: "react, docs", note: "Read before Friday" });
    expect(panel().getByText("Read before Friday")).toBeDefined();
  });

  test("closes with the Close button or Esc", () => {
    open();
    fireEvent.click(panel().getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary", { name: "React" })).toBeNull();

    fireEvent.click(cards().getByRole("button", { name: "Details" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("complementary", { name: "React" })).toBeNull();
  });

  test("deleting from the panel removes the link and closes the panel", async () => {
    open();

    await act(async () => {
      fireEvent.click(panel().getByRole("button", { name: "Delete" }));
    });

    expect(removeLink).toHaveBeenCalledWith("1");
    expect(screen.queryByRole("complementary", { name: "React" })).toBeNull();
    expect(cardCount()).toBe(0);
  });
});
