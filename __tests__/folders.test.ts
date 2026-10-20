import { expect, test } from "vitest";
import { FOLDER_COLORS, FOLDER_DOT_CLASS, isFolderColor, nextFolderColor } from "@/lib/folders";

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

test("every colour has its dot class", () => {
  for (const color of FOLDER_COLORS) {
    expect(FOLDER_DOT_CLASS[color]).toBe(`bg-folder-${color}`);
  }
});
