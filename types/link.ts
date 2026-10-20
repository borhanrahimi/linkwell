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
};

export type Folder = {
  id: string;
  name: string;
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
  folder?: string;
  addDate?: string;
};
