import type { FolderColor, FolderIcon } from "@/types/link";

// The longest folder name (lib/links.ts checks names against it).
export const FOLDER_NAME_MAX_LENGTH = 100;

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

// Same idea for drawings in the folder's colour.
export const FOLDER_TEXT_CLASS: Record<FolderColor, string> = {
  blue: "text-folder-blue",
  green: "text-folder-green",
  yellow: "text-folder-yellow",
  orange: "text-folder-orange",
  red: "text-folder-red",
  purple: "text-folder-purple",
  pink: "text-folder-pink",
  gray: "text-folder-gray",
};

// The hand-drawn icons a folder can have instead of its dot.
export const FOLDER_ICONS: FolderIcon[] = [
  "book", "coffee", "plane", "code", "music", "heart",
  "star", "briefcase", "home", "cart", "camera", "leaf",
];

export function isFolderIcon(value: unknown): value is FolderIcon {
  return FOLDER_ICONS.includes(value as FolderIcon);
}

// ---- Folders inside folders ----
// The browser and the server both get the flat list of folders (each knows
// its parentId); these build the tree from it. A folder whose parent isn't in
// the list (deleted, or never there) counts as a top-level folder.

type TreeFolder = { id: string; name: string; parentId?: string };

function parentOf<F extends TreeFolder>(folders: F[], folder: F): string | undefined {
  return folder.parentId && folders.some((other) => other.id === folder.parentId) ? folder.parentId : undefined;
}

// The folders directly inside `parentId` (null: the top level), in list order.
export function childFolders<F extends TreeFolder>(folders: F[], parentId: string | null): F[] {
  return folders.filter((folder) => (parentOf(folders, folder) ?? null) === parentId);
}

// The folder and the folders it's inside, from the top level down to it:
// [Work, Clients] for Clients. Stops if the list ever holds a loop.
export function folderPath<F extends TreeFolder>(folders: F[], id: string): F[] {
  const path: F[] = [];
  let current = folders.find((folder) => folder.id === id);
  while (current && !path.includes(current)) {
    path.unshift(current);
    const parentId = parentOf(folders, current);
    current = parentId ? folders.find((folder) => folder.id === parentId) : undefined;
  }
  return path;
}

// The folder's id and the ids of every folder inside it, at any depth.
export function folderAndInside<F extends TreeFolder>(folders: F[], id: string): Set<string> {
  const found = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) {
      const parentId = parentOf(folders, folder);
      if (parentId && found.has(parentId) && !found.has(folder.id)) {
        found.add(folder.id);
        grew = true;
      }
    }
  }
  return found;
}

// Every folder in tree order (each followed by what's inside it) with its
// depth, 0 for the top level: for menus that show the tree with indents.
export function flattenTree<F extends TreeFolder>(folders: F[]): { folder: F; depth: number }[] {
  const rows: { folder: F; depth: number }[] = [];
  const seen = new Set<string>();
  function visit(parentId: string | null, depth: number) {
    for (const folder of childFolders(folders, parentId)) {
      if (seen.has(folder.id)) continue;
      seen.add(folder.id);
      rows.push({ folder, depth });
      visit(folder.id, depth + 1);
    }
  }
  visit(null, 0);
  return rows;
}

// A folder's name in a menu (<option> can't be styled): indented by its depth.
export function indentedName(name: string, depth: number): string {
  return "   ".repeat(depth) + name;
}

// True when another folder in the same place (same parent) has this name,
// ignoring case. Names only have to be unique among neighbours.
export function nameTakenIn<F extends TreeFolder>(folders: F[], name: string, parentId: string | null, exceptId?: string): boolean {
  return childFolders(folders, parentId).some(
    (folder) => folder.id !== exceptId && folder.name.toLowerCase() === name.toLowerCase()
  );
}

// How many links each folder holds, counting the folders inside it too.
export function countWithInside<F extends TreeFolder>(folders: F[], links: { folderId?: string }[]): Record<string, number> {
  const own: Record<string, number> = {};
  for (const link of links) {
    if (link.folderId) own[link.folderId] = (own[link.folderId] ?? 0) + 1;
  }
  const counts: Record<string, number> = {};
  for (const folder of folders) {
    let total = 0;
    for (const id of folderAndInside(folders, folder.id)) total += own[id] ?? 0;
    counts[folder.id] = total;
  }
  return counts;
}

// A folder's name, or "Reading (2)", "Reading (3)"… when it's taken (any
// case), still within the length limit. For restoring a folder from the Trash.
export function freeFolderName(name: string, taken: string[]): string {
  const used = new Set(taken.map((other) => other.toLowerCase()));
  if (!used.has(name.toLowerCase())) return name;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate = name.slice(0, FOLDER_NAME_MAX_LENGTH - suffix.length) + suffix;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

// Deleting a folder moves the folders inside it up one level. Those whose
// name is already taken up there get a free one: the renames to make.
export function renamesMovingUp<F extends TreeFolder>(folders: F[], id: string): { id: string; name: string }[] {
  const folder = folders.find((f) => f.id === id);
  const parentId = folder ? (parentOf(folders, folder) ?? null) : null;
  const taken = childFolders(folders, parentId)
    .filter((f) => f.id !== id)
    .map((f) => f.name);
  const renames: { id: string; name: string }[] = [];
  for (const child of childFolders(folders, id)) {
    const name = freeFolderName(child.name, taken);
    taken.push(name);
    if (name !== child.name) renames.push({ id: child.id, name });
  }
  return renames;
}

// ---- Your own order (dragging, Move up / Move down) ----

// Puts a folder into `parentId` (null: the top level) at `index` among the
// folders already there, and numbers that level 0, 1, 2… again. Without an
// index it keeps its place when it stays where it is, and goes last when it
// moves. Returns the whole list in its new order. Doesn't check for loops:
// moveFolder does that first.
export function placeFolder<F extends TreeFolder & { position?: number }>(
  folders: F[],
  id: string,
  parentId: string | null,
  index?: number
): F[] {
  const folder = folders.find((f) => f.id === id);
  if (!folder) return folders;
  const before = childFolders(folders, parentId);
  const others = before.filter((f) => f.id !== id);
  const stays = before.includes(folder);
  const at = index === undefined ? (stays ? before.indexOf(folder) : others.length) : Math.min(Math.max(index, 0), others.length);
  const order = [...others.slice(0, at).map((f) => f.id), id, ...others.slice(at).map((f) => f.id)];
  const positions = new Map(order.map((other, i) => [other, i]));
  const moved = folders.map((f) => {
    const position = positions.get(f.id);
    if (f.id === id) return { ...f, parentId: parentId ?? undefined, position };
    return position === undefined || f.position === position ? f : { ...f, position };
  });
  // Folders are shown in list order, so the list follows the new numbers. The
  // sort keeps equal ones as they were, so other levels don't change.
  return moved.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

// Where a folder is: its parent (null: the top level) and its index there.
export function placeOf<F extends TreeFolder>(folders: F[], id: string): { parentId: string | null; index: number } {
  const folder = folders.find((f) => f.id === id);
  const parentId = folder ? (parentOf(folders, folder) ?? null) : null;
  return { parentId, index: childFolders(folders, parentId).findIndex((f) => f.id === id) };
}

// The next free place at the end of a level, for a new or restored folder.
export function nextPosition<F extends TreeFolder & { position?: number }>(folders: F[], parentId: string | null): number {
  return Math.max(-1, ...childFolders(folders, parentId).map((f) => f.position ?? 0)) + 1;
}

// The same folders, A to Z within each level (the sidebar's "A to Z" choice).
export function sortedByName<F extends TreeFolder>(folders: F[]): F[] {
  return [...folders].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
}
