import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import ImportBookmarks from "@/components/ImportBookmarks";
import { importBookmarks } from "@/app/actions";

vi.mock("@/app/actions", () => ({
  importBookmarks: vi.fn(async (batch: unknown[]) => ({ added: batch.length, skipped: 0 })),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function bookmarksFile(count: number, folder = "Recipes") {
  const links = Array.from({ length: count }, (_, i) => `<DT><A HREF="https://example.com/${i}">Link ${i}</A>`);
  const html = `<DL><p><DT><H3>${folder}</H3><DL><p>${links.join("\n")}</DL><p></DL><p>`;
  return new File([html], "bookmarks.html", { type: "text/html" });
}

async function choose(file: File) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Choose bookmarks file"), { target: { files: [file] } });
  });
}

test("shows what's in the file before importing anything", async () => {
  render(<ImportBookmarks />);

  await choose(bookmarksFile(3));

  expect(screen.getByRole("status").textContent).toBe("Found 3 links in 1 folder. Links you already saved will be skipped.");
  expect(importBookmarks).not.toHaveBeenCalled();
});

test("imports in batches of 200 and adds up the results", async () => {
  vi.mocked(importBookmarks).mockResolvedValueOnce({ added: 190, skipped: 10 });
  render(<ImportBookmarks />);
  await choose(bookmarksFile(250));

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Import 250 links" }));
  });

  expect(importBookmarks).toHaveBeenCalledTimes(2);
  expect(vi.mocked(importBookmarks).mock.calls[0][0]).toHaveLength(200);
  expect(vi.mocked(importBookmarks).mock.calls[1][0]).toHaveLength(50);
  expect(screen.getByRole("status").textContent).toBe(
    "Imported 240 links. Skipped 10 (already saved, or not a web address)."
  );
  expect(screen.getByRole("link", { name: "Go to my links" })).toBeDefined();
});

test("says what was saved when a batch fails", async () => {
  vi.mocked(importBookmarks)
    .mockResolvedValueOnce({ added: 200, skipped: 0 })
    .mockRejectedValueOnce(new Error("Network"));
  render(<ImportBookmarks />);
  await choose(bookmarksFile(250));

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Import 250 links" }));
  });

  expect(screen.getByRole("status").textContent).toBe("Imported 200 links.");
  expect(screen.getByRole("alert").textContent).toMatch(/import stopped/);
});

test("explains when the file has no links", async () => {
  render(<ImportBookmarks />);

  await choose(new File(["just some text"], "notes.txt"));

  expect(screen.getByRole("alert").textContent).toMatch(/No links found/);
});

test("Cancel goes back without importing", async () => {
  render(<ImportBookmarks />);
  await choose(bookmarksFile(2));

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(screen.getByLabelText("Choose bookmarks file")).toBeDefined();
  expect(importBookmarks).not.toHaveBeenCalled();
});

test("stops and says why when the server says it's too fast", async () => {
  vi.mocked(importBookmarks)
    .mockResolvedValueOnce({ added: 200, skipped: 0 })
    .mockResolvedValueOnce("You're going a bit fast. Please wait a moment and try again.");
  render(<ImportBookmarks />);
  await choose(bookmarksFile(450));

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Import 450 links" }));
  });

  expect(importBookmarks).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("status").textContent).toBe("Imported 200 links.");
  expect(screen.getByRole("alert").textContent).toBe("You're going a bit fast. Please wait a moment and try again.");
});
