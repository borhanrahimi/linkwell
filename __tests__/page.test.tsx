import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import LinkManager from "@/components/LinkManager";
import { checkAllLinks, removeLink, saveLink, saveReadStatus, saveTitle } from "@/app/actions";
import { STORAGE_KEY } from "@/lib/links";

vi.mock("@/app/actions", () => ({
  checkAllLinks: vi.fn(async () => []),
  importLinks: vi.fn(async (links) => links),
  saveLink: vi.fn(async (link) => link),
  removeLink: vi.fn(async () => { }),
  saveTitle: vi.fn(async () => { }),
  saveReadStatus: vi.fn(async () => {}),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
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

describe("checking links", () => {
  const working = { id: "1", url: "https://working.com", createdAt: "2026-10-01T12:00:00.000Z" };
  const dead = { id: "2", url: "https://dead.com", createdAt: "2026-10-02T12:00:00.000Z" };

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

    expect(screen.getByText("Broken")).toBeDefined();
  });

  test("shows no badge on a working link", () => {
    render(<LinkManager initialLinks={[{ ...base, status: "ok" }]} />);

    expect(screen.queryByText("Broken")).toBeNull();
  });

  test("shows no badge on a link that was never checked", () => {
    render(<LinkManager initialLinks={[base]} />);

    expect(screen.queryByText("Broken")).toBeNull();
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

    expect(screen.getByText("Broken").getAttribute("title")).toBe("Checked 2 days ago");
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
