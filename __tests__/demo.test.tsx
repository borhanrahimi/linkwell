import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import DemoApp from "@/components/DemoApp";
import * as server from "@/app/actions";
import { DEMO_CHECK_MESSAGE, demoLinks, makeDemoActions } from "@/lib/demo";
import { pickRediscover } from "@/lib/links";

// If the demo ever called the real server, these would record it.
vi.mock("@/app/actions", () => ({
  checkAllLinks: vi.fn(),
  createFolder: vi.fn(),
  deleteFolder: vi.fn(),
  importLinks: vi.fn(),
  markLinksRead: vi.fn(),
  moveLinksToFolder: vi.fn(),
  moveToFolder: vi.fn(),
  removeLink: vi.fn(),
  renameFolder: vi.fn(),
  saveLink: vi.fn(),
  saveLinkDetails: vi.fn(),
  saveReadStatus: vi.fn(),
  setFolderColor: vi.fn(),
  setFolderIcon: vi.fn(),
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { signIn: { social: vi.fn() } } }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.clearAllMocks();
});

const now = new Date("2026-10-21T12:00:00.000Z");
const serverWasCalled = () => Object.values(server).some((action) => vi.mocked(action).mock.calls.length > 0);

describe("the demo's sample links", () => {
  test("look lived-in: folders, a note, a read link, a broken link, and something to rediscover", () => {
    const links = demoLinks(now);

    expect(links.some((link) => link.folderId)).toBe(true);
    expect(links.some((link) => link.note)).toBe(true);
    expect(links.some((link) => link.readAt)).toBe(true);
    expect(links.some((link) => link.status === "broken")).toBe(true);
    expect(pickRediscover(links, now).length).toBeGreaterThan(0);
    // Example addresses only: no real sites or brands.
    expect(links.every((link) => /^https:\/\/example\.(com|org|net)\//.test(link.url))).toBe(true);
  });
});

describe("the demo's stand-in actions", () => {
  test("clean and refuse links like the server does", async () => {
    const actions = makeDemoActions();

    expect(await actions.saveLink({ id: "x", url: "javascript:alert(1)", createdAt: now.toISOString() })).toMatch(/Only web links/);
    expect(await actions.saveLink({ id: "x", url: "https://example.com/new", createdAt: now.toISOString() })).toMatchObject({
      url: "https://example.com/new",
      title: "example.com",
    });
  });

  test("refuse a second folder with the same name, also when renaming", async () => {
    const actions = makeDemoActions();

    expect(await actions.createFolder("reading")).toBe('You already have a folder called "reading".');
    const travel = await actions.createFolder("Travel");
    expect(travel).toMatchObject({ name: "Travel" });
    expect(await actions.renameFolder((travel as { id: string }).id, "Work")).toBe('You already have a folder called "Work".');
  });

  test("explain that checking links needs an account", async () => {
    expect(await makeDemoActions().checkAllLinks()).toBe(DEMO_CHECK_MESSAGE);
  });
});

describe("the demo page", () => {
  test("shows the sample links, says it's a demo, and offers to sign in", () => {
    render(<DemoApp now={now} />);

    expect(screen.getByRole("link", { name: "Notes on CSS grid layouts" })).toBeDefined();
    expect(screen.getByText("Demo")).toBeDefined();
    expect(screen.getByRole("button", { name: "Sign in to start" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  test("saves, reads and files links in the browser only, never on the server", async () => {
    render(<DemoApp now={now} />);

    fireEvent.change(screen.getByPlaceholderText("Paste a link..."), { target: { value: "https://example.com/mine" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(screen.getByRole("link", { name: "example.com" })).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Mark read" })[0]);
    });
    const sidebar = within(screen.getByRole("navigation", { name: "Your lists" }));
    fireEvent.click(sidebar.getByRole("button", { name: "+ New folder" }));
    fireEvent.change(sidebar.getByRole("textbox", { name: "Folder name" }), { target: { value: "Travel" } });
    await act(async () => {
      fireEvent.click(sidebar.getByRole("button", { name: "Create" }));
    });
    expect(sidebar.getByRole("button", { name: "Travel" })).toBeDefined();

    expect(serverWasCalled()).toBe(false);
  });
});
