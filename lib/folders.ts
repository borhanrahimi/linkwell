import type { FolderColor } from "@/types/link";

// The folder palette: Apple's system colours. The shades live in globals.css
// (--folder-blue, ...), with brighter ones for dark mode.
export const FOLDER_COLORS: FolderColor[] = ["blue", "green", "yellow", "orange", "red", "purple", "pink", "gray"];

export function isFolderColor(value: unknown): value is FolderColor {
  return FOLDER_COLORS.includes(value as FolderColor);
}

// New folders take the next colour in the palette, so they're colourful
// without anyone choosing. Gray is last, so it only comes after seven others.
export function nextFolderColor(folderCount: number): FolderColor {
  return FOLDER_COLORS[folderCount % FOLDER_COLORS.length];
}

// Tailwind only builds classes it finds written out in full, so each colour's
// class is spelled out here instead of being put together ("bg-folder-" + color).
export const FOLDER_DOT_CLASS: Record<FolderColor, string> = {
  blue: "bg-folder-blue",
  green: "bg-folder-green",
  yellow: "bg-folder-yellow",
  orange: "bg-folder-orange",
  red: "bg-folder-red",
  purple: "bg-folder-purple",
  pink: "bg-folder-pink",
  gray: "bg-folder-gray",
};
