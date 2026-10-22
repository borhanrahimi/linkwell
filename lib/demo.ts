import type { LinkActions } from "@/components/LinkActions";
import { nextFolderColor } from "@/lib/folders";
import { cleanDetails, cleanFolderName, cleanNewLink, getDomain } from "@/lib/links";
import { MAX_FOLDERS, TOO_MANY_FOLDERS } from "@/lib/limits";
import type { Folder, Link } from "@/types/link";

// The demo (/demo): Linkwell with sample links, for visitors who want to try
// it before signing in. Made-up titles on example addresses, no real brands.

const DAY = 24 * 60 * 60 * 1000;

export const DEMO_FOLDERS: Folder[] = [
  { id: "demo-reading", name: "Reading", color: "blue", icon: "book" },
  { id: "demo-recipes", name: "Recipes", color: "green", icon: "coffee" },
  { id: "demo-work", name: "Work", color: "yellow", icon: "briefcase" },
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
    link("1", 1, { url: "https://example.org/css-grid", title: "Notes on CSS grid layouts", tags: ["css", "web", "design"] }),
    link("2", 2, { url: "https://example.com/sourdough", title: "Sourdough starter, step by step", tags: ["food"], folderId: "demo-recipes" }),
    link("3", 3, {
      url: "https://example.com/calm-interfaces",
      title: "How to write calm interfaces",
      tags: ["design", "ux"],
      folderId: "demo-reading",
      readAt: ago(1),
    }),
    link("4", 5, { url: "https://example.net/database-indexes", title: "A gentle guide to database indexes", tags: ["db"], folderId: "demo-work" }),
    link("5", 12, {
      url: "https://example.org/coast-hikes",
      title: "Weekend hikes near the coast",
      tags: ["travel"],
      note: "For the long weekend in spring",
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
    link("8", 70, { url: "https://example.org/hyperlink-history", title: "The long history of the hyperlink", tags: ["web", "history"], folderId: "demo-reading" }),
  ];
}

export const DEMO_CHECK_MESSAGE = "Checking links works once you sign in. In the demo, one link is already broken.";

// Stand-ins for the Server Actions: they answer like the server would (same
// cleaning, same messages) but nothing leaves the browser, and a refresh
// starts over. Folder names are remembered here, to refuse duplicates.
export function makeDemoActions(folders: Folder[] = DEMO_FOLDERS): LinkActions {
  const folderNames = new Map(folders.map((folder) => [folder.id, folder.name.toLowerCase()]));

  return {
    async saveLink(input) {
      const link = cleanNewLink(input);
      if (typeof link === "string") return link;
      // The server would read the page's title; the demo uses the site's name.
      return { ...link, folderId: input.folderId, title: link.title ?? getDomain(link.url) };
    },
    async removeLink() {},
    async saveLinkDetails(_id, input) {
      return cleanDetails(input);
    },
    async saveReadStatus() {},
    async moveToFolder() {},
    async importLinks() {
      return [];
    },
    async checkAllLinks() {
      return DEMO_CHECK_MESSAGE;
    },
    async createFolder(name) {
      const cleaned = cleanFolderName(name);
      if ("error" in cleaned) return cleaned.error;
      if (folderNames.size >= MAX_FOLDERS) return TOO_MANY_FOLDERS;
      if ([...folderNames.values()].includes(cleaned.name.toLowerCase())) {
        return `You already have a folder called "${cleaned.name}".`;
      }
      const folder = { id: crypto.randomUUID(), name: cleaned.name, color: nextFolderColor(folderNames.size) };
      folderNames.set(folder.id, cleaned.name.toLowerCase());
      return folder;
    },
    async renameFolder(id, name) {
      const cleaned = cleanFolderName(name);
      if ("error" in cleaned) return cleaned.error;
      const others = [...folderNames].filter(([folderId]) => folderId !== id).map(([, other]) => other);
      if (others.includes(cleaned.name.toLowerCase())) {
        return `You already have a folder called "${cleaned.name}".`;
      }
      folderNames.set(id, cleaned.name.toLowerCase());
      return null;
    },
    async setFolderColor() {},
    async setFolderIcon() {},
    async deleteFolder(id) {
      folderNames.delete(id);
    },
  };
}
