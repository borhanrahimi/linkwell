import { expect, test } from "vitest";
import { FOLDER_COLORS, FOLDER_DOT_CLASS, FOLDER_ICONS, FOLDER_TEXT_CLASS, isFolderColor, isFolderIcon, nextFolderColor } from "@/lib/folders";

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
