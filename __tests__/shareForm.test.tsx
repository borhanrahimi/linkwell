import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import ShareForm from "@/components/ShareForm";
import { createFolder, saveLink } from "@/app/actions";

vi.mock("@/app/actions", () => ({
  saveLink: vi.fn(async (link) => link),
  createFolder: vi.fn(async (name: string) => ({ id: "f9", name })),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

const folders = [{ id: "f1", name: "Recipes" }, { id: "f2", name: "Work" }];
const folderMenu = () => screen.getByRole("combobox", { name: "Save to folder" });

async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save link" }));
  });
}

describe("the share page's form", () => {
  test("saves into the chosen folder, and says where", async () => {
    render(<ShareForm url="https://example.com/soup" title="Soup" initialFolders={folders} />);

    fireEvent.change(folderMenu(), { target: { value: "f1" } });
    await save();

    expect(saveLink).toHaveBeenCalledWith(expect.objectContaining({ url: "https://example.com/soup", folderId: "f1" }));
    expect(screen.getByRole("status").textContent).toContain("Saved to Linkwell in Recipes.");
  });

  test("remembers the last folder for next time, like a browser's bookmark dialog", async () => {
    const first = render(<ShareForm url="https://example.com/one" title="" initialFolders={folders} />);
    fireEvent.change(folderMenu(), { target: { value: "f2" } });
    await save();
    first.unmount();

    render(<ShareForm url="https://example.com/two" title="" initialFolders={folders} />);
    expect(folderMenu()).toHaveProperty("value", "f2");
  });

  test("forgets a remembered folder that no longer exists", () => {
    localStorage.setItem("linkwell:last-folder", "deleted-folder");
    render(<ShareForm url="https://example.com/one" title="" initialFolders={folders} />);

    expect(folderMenu()).toHaveProperty("value", "");
  });

  test("makes a new folder right there and saves into it", async () => {
    render(<ShareForm url="https://example.com/trip" title="" initialFolders={folders} />);

    fireEvent.change(folderMenu(), { target: { value: "new-folder" } });
    fireEvent.change(screen.getByRole("textbox", { name: "New folder name" }), { target: { value: "Travel" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create" }));
    });
    expect(createFolder).toHaveBeenCalledWith("Travel");
    expect(folderMenu()).toHaveProperty("value", "f9");

    await save();
    expect(saveLink).toHaveBeenCalledWith(expect.objectContaining({ folderId: "f9" }));
  });

  test("saves with no folder when none is picked", async () => {
    render(<ShareForm url="https://example.com/plain" title="" initialFolders={[]} />);

    await save();

    expect(vi.mocked(saveLink).mock.calls[0][0].folderId).toBeUndefined();
    expect(screen.getByRole("status").textContent).toContain("Saved to Linkwell.");
  });
});
