import { describe, expect, test } from "vitest";
import {
  childFolders,
  countWithInside,
  flattenTree,
  folderAndInside,
  folderPath,
  FOLDER_COLORS,
  FOLDER_DOT_CLASS,
  FOLDER_ICONS,
  FOLDER_TEXT_CLASS,
  indentedName,
  isFolderColor,
  isFolderIcon,
  nameTakenIn,
  nextFolderColor,
  renamesMovingUp,
  nextPosition,
  placeFolder,
  placeOf,
  sortedByName,
} from "@/lib/folders";

test("new folders go through the palette in order, then start again", () => {
  expect(nextFolderColor(0)).toBe("blue");
  expect(nextFolderColor(1)).toBe("green");
  expect(nextFolderColor(FOLDER_COLORS.length)).toBe("blue");
});

test("only palette colours count", () => {
  expect(isFolderColor("pink")).toBe(true);
  expect(isFolderColor("rainbow")).toBe(false);
  expect(isFolderColor(null)).toBe(false);
});

test("every colour has its dot and text class", () => {
  for (const color of FOLDER_COLORS) {
    expect(FOLDER_DOT_CLASS[color]).toBe(`bg-folder-${color}`);
    expect(FOLDER_TEXT_CLASS[color]).toBe(`text-folder-${color}`);
  }
});

test("only the drawn icons count", () => {
  expect(FOLDER_ICONS).toHaveLength(12);
  expect(isFolderIcon("coffee")).toBe(true);
  expect(isFolderIcon("rocket")).toBe(false);
});

describe("folders inside folders", () => {
  // Work › Clients › Acme, Work › Ideas, Home.
  const folders = [
    { id: "w", name: "Work" },
    { id: "c", name: "Clients", parentId: "w" },
    { id: "a", name: "Acme", parentId: "c" },
    { id: "i", name: "Ideas", parentId: "w" },
    { id: "h", name: "Home" },
  ];

  test("finds the folders directly inside one, or at the top level", () => {
    expect(childFolders(folders, null).map((f) => f.name)).toEqual(["Work", "Home"]);
    expect(childFolders(folders, "w").map((f) => f.name)).toEqual(["Clients", "Ideas"]);
  });

  test("a folder whose parent is gone counts as top level", () => {
    expect(childFolders([{ id: "x", name: "Lost", parentId: "gone" }], null).map((f) => f.name)).toEqual(["Lost"]);
  });

  test("knows a folder's path from the top, and everything inside it", () => {
    expect(folderPath(folders, "a").map((f) => f.name)).toEqual(["Work", "Clients", "Acme"]);
    expect([...folderAndInside(folders, "w")].sort()).toEqual(["a", "c", "i", "w"]);
    expect([...folderAndInside(folders, "h")]).toEqual(["h"]);
  });

  test("never loops forever, even if the data ever held a loop", () => {
    const loop = [
      { id: "1", name: "One", parentId: "2" },
      { id: "2", name: "Two", parentId: "1" },
    ];
    expect(folderPath(loop, "1").map((f) => f.id)).toEqual(["2", "1"]);
    expect([...folderAndInside(loop, "1")].sort()).toEqual(["1", "2"]);
    expect(flattenTree(loop)).toEqual([]);
  });

  test("lists the tree in order, with each folder's depth, for indented menus", () => {
    expect(flattenTree(folders).map(({ folder, depth }) => indentedName(folder.name, depth))).toEqual([
      "Work",
      "   Clients",
      "      Acme",
      "   Ideas",
      "Home",
    ]);
  });

  test("names only clash with neighbours, ignoring case", () => {
    expect(nameTakenIn(folders, "ideas", "w")).toBe(true);
    expect(nameTakenIn(folders, "Ideas", "h")).toBe(false);
    expect(nameTakenIn(folders, "Ideas", null)).toBe(false);
    expect(nameTakenIn(folders, "ideas", "w", "i")).toBe(false);
  });

  test("counts a folder's links together with those in the folders inside it", () => {
    const links = [{ folderId: "w" }, { folderId: "c" }, { folderId: "a" }, { folderId: "a" }, {}];
    expect(countWithInside(folders, links)).toEqual({ w: 4, c: 3, a: 2, i: 0, h: 0 });
  });

  test("renames folders moving up next to one with the same name", () => {
    const clash = [...folders, { id: "i2", name: "ideas" }];
    // Deleting Work moves Clients and Ideas to the top level, next to "ideas".
    expect(renamesMovingUp(clash, "w")).toEqual([{ id: "i", name: "Ideas (2)" }]);
    expect(renamesMovingUp(folders, "c")).toEqual([]);
  });
});

describe("your own order", () => {
  const work = { id: "w", name: "Work", position: 0 };
  const home = { id: "h", name: "home", position: 1 };
  const ideas = { id: "i", name: "Ideas", position: 2 };
  const clients = { id: "c", name: "Clients", parentId: "w", position: 0 };
  const all = [work, home, ideas, clients];
  const names = (folders: { name: string }[]) => folders.map((f) => f.name);

  test("puts a folder at a place among its neighbours, and numbers them again", () => {
    const moved = placeFolder(all, "i", null, 0);
    expect(names(childFolders(moved, null))).toEqual(["Ideas", "Work", "home"]);
    expect(childFolders(moved, null).map((f) => f.position)).toEqual([0, 1, 2]);
    // The other levels don't change.
    expect(childFolders(moved, "w")).toEqual([clients]);
  });

  test("into another folder: last without a place, or at the place given", () => {
    expect(names(childFolders(placeFolder(all, "h", "w"), "w"))).toEqual(["Clients", "home"]);
    expect(names(childFolders(placeFolder(all, "h", "w", 0), "w"))).toEqual(["home", "Clients"]);
    // What it left closes up.
    expect(childFolders(placeFolder(all, "h", "w"), null).map((f) => f.position)).toEqual([0, 2]);
  });

  test("staying put without a place keeps it there; a place past the end means last", () => {
    expect(names(childFolders(placeFolder(all, "h", null), null))).toEqual(["Work", "home", "Ideas"]);
    expect(names(childFolders(placeFolder(all, "w", null, 99), null))).toEqual(["home", "Ideas", "Work"]);
    expect(placeFolder(all, "nope", null, 0)).toBe(all);
  });

  test("says where a folder is, and the next free place at the end of a level", () => {
    expect(placeOf(all, "c")).toEqual({ parentId: "w", index: 0 });
    expect(placeOf(all, "i")).toEqual({ parentId: null, index: 2 });
    expect(nextPosition(all, null)).toBe(3);
    expect(nextPosition(all, "c")).toBe(0);
  });

  test("A to Z ignores case and reads numbers as numbers", () => {
    expect(names(sortedByName([work, home, ideas, { id: "x", name: "Week 10" }, { id: "y", name: "Week 9" }]))).toEqual([
      "home",
      "Ideas",
      "Week 9",
      "Week 10",
      "Work",
    ]);
  });
});
