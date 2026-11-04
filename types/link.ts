export type LinkStatus = "ok" | "broken";

export type Link = {
  id: string;
  url: string;
  title?: string;
  tags?: string[];
  note?: string;
  createdAt: string;
  status?: LinkStatus;
  checkedAt?: string;
  readAt?: string;
  folderId?: string;
  // The page's sharing picture (https), shown on its card.
  image?: string;
  // The folder this link was in before that folder went to the Trash.
  cameFromFolderId?: string;
  // When it went to the Trash (only links in the Trash have one).
  deletedAt?: string;
};

// The palette in lib/folders.ts (FOLDER_COLORS).
export type FolderColor = "blue" | "green" | "yellow" | "orange" | "red" | "purple" | "pink" | "gray";

// The hand-drawn icons in components/FolderIcon.tsx (FOLDER_ICONS).
export type FolderIcon =
  | "book" | "coffee" | "plane" | "code" | "music" | "heart"
  | "star" | "briefcase" | "home" | "cart" | "camera" | "leaf";

export type Folder = {
  id: string;
  name: string;
  color?: FolderColor;
  icon?: FolderIcon;
  // The folder it's inside; none for a top-level folder.
  parentId?: string;
  // The folder it was inside before that folder went to the Trash.
  cameFromFolderId?: string;
  // Pinned to Home: shown first in Home's "Your folders".
  pinned?: boolean;
  // When it went to the Trash (only folders in the Trash have one).
  deletedAt?: string;
};
// What the Edit form sends: the raw text from its three boxes.
export type LinkDetailsInput = {
  title: string;
  tags: string;
  note: string;
};

// The same, cleaned up: what is stored and shown.
export type LinkDetails = {
  title?: string;
  tags: string[];
  note?: string;
};

// One link read from a browser's bookmarks file, before it is saved.
export type ImportedBookmark = {
  url: string;
  title?: string;
  tags: string[];
  // The folder it's in (the nearest one), and the whole path of folders down
  // to it, outermost first: ["Work", "Clients"].
  folder?: string;
  folderPath?: string[];
  addDate?: string;
};
