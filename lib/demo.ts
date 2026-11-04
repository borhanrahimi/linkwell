import type { LinkActions } from "@/components/LinkActions";
import { childFolders, folderAndInside, freeFolderName, nameTakenIn, nextFolderColor, renamesMovingUp } from "@/lib/folders";
import { cleanDetails, cleanFolderName, cleanNewLink, getDomain } from "@/lib/links";
import { MAX_FOLDERS, TOO_MANY_FOLDERS } from "@/lib/limits";
import type { Folder, Link } from "@/types/link";

// The demo (/demo): Linkwell with sample links, for visitors who want to try
// it before signing in. Made-up titles on example addresses, no real brands;
// some have simple cover pictures of our own (public/demo/), so the demo shows
// preview pictures too.

const DAY = 24 * 60 * 60 * 1000;

export const DEMO_FOLDERS: Folder[] = [
  { id: "demo-reading", name: "Reading", color: "blue", icon: "book" },
  { id: "demo-recipes", name: "Recipes", color: "green", icon: "coffee" },
  { id: "demo-work", name: "Work", color: "yellow", icon: "briefcase" },
  // A folder inside a folder, so the tree shows.
  { id: "demo-design", name: "Design", color: "purple", icon: "star", parentId: "demo-reading" },
];

// Saved some days before `now`, so dates and Rediscover look lived-in.
export function demoLinks(now: Date): Link[] {
  const ago = (days: number) => new Date(now.getTime() - days * DAY).toISOString();
  const link = (id: string, days: number, rest: Omit<Link, "id" | "createdAt">): Link => ({
    id: `00000000-0000-4000-8000-00000000000${id}`,
    createdAt: ago(days),
    ...rest,
  });
  return [
    link("1", 1, { url: "https://example.org/css-grid", title: "Notes on CSS grid layouts", tags: ["css", "web", "design"], image: "/demo/css-grid.svg" }),
    link("2", 2, { url: "https://example.com/sourdough", title: "Sourdough starter, step by step", tags: ["food"], folderId: "demo-recipes", image: "/demo/sourdough.svg" }),
    link("3", 3, {
      url: "https://example.com/calm-interfaces",
      title: "How to write calm interfaces",
      tags: ["design", "ux"],
      folderId: "demo-design",
      readAt: ago(1),
      image: "/demo/calm-interfaces.svg",
    }),
    link("4", 5, { url: "https://example.net/database-indexes", title: "A gentle guide to database indexes", tags: ["db"], folderId: "demo-work" }),
    link("5", 12, {
      url: "https://example.org/coast-hikes",
      title: "Weekend hikes near the coast",
      tags: ["travel"],
      note: "For the long weekend in spring",
      image: "/demo/coast-hikes.svg",
    }),
    link("6", 20, {
      url: "https://example.net/old-conference-talk",
      title: "A conference talk that moved",
      tags: ["tips"],
      folderId: "demo-work",
      status: "broken",
      checkedAt: ago(1),
    }),
    link("7", 40, {
      url: "https://example.com/saffron-rice",
      title: "Saffron rice with barberries",
      tags: ["food", "persian"],
      folderId: "demo-recipes",
      note: "For Friday dinner with friends",
    }),
    link("8", 70, { url: "https://example.org/hyperlink-history", title: "The long history of the hyperlink", tags: ["web", "history"], folderId: "demo-reading", image: "/demo/hyperlink.svg" }),
  ];
}

export const DEMO_CHECK_MESSAGE = "Checking links works once you sign in. In the demo, one link is already broken.";

// Stand-ins for the Server Actions: they answer like the server would (same
// cleaning, same messages) but nothing leaves the browser, and a refresh
// starts over. The folders' names and places are remembered here, to refuse
// duplicates and loops, and so are the folders in the Trash, to restore them.
export function makeDemoActions(folders: Folder[] = DEMO_FOLDERS): LinkActions {
  type Place = { id: string; name: string; parentId?: string };
  const live = new Map<string, Place>(folders.map(({ id, name, parentId }) => [id, { id, name, parentId }]));
  const trashed = new Map<string, Place>();
  // Folders that moved up a level when the folder they were in was deleted.
  const movedOut = new Map<string, string>();
  const list = () => [...live.values()];
  const taken = (name: string, parentId: string | null, exceptId?: string) => {
    const parent = parentId ? live.get(parentId) : undefined;
    return nameTakenIn(list(), name, parentId, exceptId)
      ? parent
        ? `There's already a folder called "${name}" in ${parent.name}.`
        : `You already have a folder called "${name}".`
      : null;
  };

  return {
    async saveLink(input) {
      const link = cleanNewLink(input);
      if (typeof link === "string") return link;
      // The server would read the page's title; the demo uses the site's name.
      return { ...link, folderId: input.folderId, title: link.title ?? getDomain(link.url) };
    },
    async removeLink() {},
    async removeLinks() {},
    // The page puts the links back itself; the server would send them too.
    async restoreLinks() {
      return [];
    },
    async restoreFolder(id) {
      const folder = trashed.get(id);
      if (!folder) return "That folder isn't in your Trash any more.";
      if (live.size >= MAX_FOLDERS) return TOO_MANY_FOLDERS;
      const parentId = folder.parentId && live.has(folder.parentId) ? folder.parentId : undefined;
      const name = freeFolderName(folder.name, childFolders(list(), parentId ?? null).map((f) => f.name));
      trashed.delete(id);
      // What was inside it moves back, as on the server.
      for (const other of live.values()) {
        if (other.parentId === folder.parentId && movedOut.get(other.id) === id) {
          other.parentId = id;
          movedOut.delete(other.id);
        }
      }
      live.set(id, { id, name, parentId });
      return { id, name, parentId };
    },
    async deleteForever(_linkIds, folderIds) {
      for (const id of folderIds) trashed.delete(id);
    },
    async emptyTrash() {
      trashed.clear();
    },
    async setReadDates() {},
    async saveLinkDetails(_id, input) {
      return cleanDetails(input);
    },
    async saveReadStatus() {},
    async moveToFolder() {},
    async moveLinksToFolder() {},
    async markLinksRead() {},
    async importLinks() {
      return [];
    },
    async checkAllLinks() {
      return DEMO_CHECK_MESSAGE;
    },
    async createFolder(name, parentId = null) {
      const cleaned = cleanFolderName(name);
      if ("error" in cleaned) return cleaned.error;
      if (live.size >= MAX_FOLDERS) return TOO_MANY_FOLDERS;
      if (parentId !== null && !live.has(parentId)) return "That folder doesn't exist any more.";
      const problem = taken(cleaned.name, parentId);
      if (problem) return problem;
      const folder: Folder = { id: crypto.randomUUID(), name: cleaned.name, color: nextFolderColor(live.size), parentId: parentId ?? undefined };
      live.set(folder.id, { id: folder.id, name: folder.name, parentId: folder.parentId });
      return folder;
    },
    async renameFolder(id, name) {
      const cleaned = cleanFolderName(name);
      if ("error" in cleaned) return cleaned.error;
      const folder = live.get(id);
      const problem = taken(cleaned.name, folder?.parentId ?? null, id);
      if (problem) return problem;
      if (folder) folder.name = cleaned.name;
      return null;
    },
    async moveFolder(id, parentId) {
      const folder = live.get(id);
      if (!folder || (parentId !== null && !live.has(parentId))) return "That folder doesn't exist any more.";
      if (parentId !== null && folderAndInside(list(), id).has(parentId)) return "A folder can't go inside itself.";
      const problem = taken(folder.name, parentId, id);
      if (problem) return problem;
      folder.parentId = parentId ?? undefined;
      movedOut.delete(id);
      return null;
    },
    async setFolderColor() {},
    async setFolderPinned() {},
    async setFolderIcon() {},
    async deleteFolder(id) {
      const folder = live.get(id);
      if (!folder) return;
      for (const { id: childId, name } of renamesMovingUp(list(), id)) live.get(childId)!.name = name;
      for (const child of childFolders(list(), id)) {
        child.parentId = folder.parentId;
        movedOut.set(child.id, id);
      }
      live.delete(id);
      trashed.set(id, folder);
    },
  };
}
