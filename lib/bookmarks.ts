import { cleanDate, cleanTags, cleanText, FOLDER_NAME_MAX_LENGTH, getDomain, isWebAddress, TITLE_MAX_LENGTH, URL_MAX_LENGTH } from "@/lib/links";
import { childFolders } from "@/lib/folders";
import type { Folder, ImportedBookmark, Link } from "@/types/link";

// Replaces the characters that mean something in HTML. Titles come from other
// websites, so without this a title like "<script>" would become real code.
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bookmarkLine(link: Link, indent: string): string {
  // Browsers store dates as seconds since 1970.
  const addDate = Math.floor(new Date(link.createdAt).getTime() / 1000);
  const tags =
    link.tags && link.tags.length > 0
      ? ` TAGS="${escapeHtml(link.tags.join(","))}"`
      : "";
  const title = escapeHtml(link.title || getDomain(link.url));
  return `${indent}<DT><A HREF="${escapeHtml(
    link.url
  )}" ADD_DATE="${addDate}"${tags}>${title}</A>`;
}

// Builds a "Netscape bookmarks file": the old HTML format that Chrome, Safari,
// Firefox and Raindrop all import and export. Folders become bookmark folders
// (<H3> followed by their own <DL> list), with the folders inside them nested
// in that list, before their links; links without a folder come last.
export function toBookmarksHtml(links: Link[], folders: Folder[]): string {
  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Linkwell</H1>",
    "<DL><p>",
  ];

  const written = new Set<string>();
  function writeFolder(folder: Folder, indent: string) {
    if (written.has(folder.id)) return;
    written.add(folder.id);
    lines.push(`${indent}<DT><H3>${escapeHtml(folder.name)}</H3>`);
    lines.push(`${indent}<DL><p>`);
    for (const inside of childFolders(folders, folder.id)) {
      writeFolder(inside, indent + "    ");
    }
    for (const link of links.filter((l) => l.folderId === folder.id)) {
      lines.push(bookmarkLine(link, indent + "    "));
    }
    lines.push(`${indent}</DL><p>`);
  }
  for (const folder of childFolders(folders, null)) {
    writeFolder(folder, "    ");
  }

  const folderIds = new Set(folders.map((folder) => folder.id));
  for (const link of links.filter(
    (l) => !l.folderId || !folderIds.has(l.folderId)
  )) {
    lines.push(bookmarkLine(link, "    "));
  }

  lines.push("</DL><p>");
  return lines.join("\n") + "\n";
}

// Folders the browser makes itself, like Chrome's "Bookmarks bar". Links in
// them get no folder in Linkwell.
function isBuiltInFolder(heading: Element): boolean {
  return (
    heading.hasAttribute("personal_toolbar_folder") ||
    heading.hasAttribute("unfiled_bookmarks_folder")
  );
}

// The most folders deep an imported link can be.
export const FOLDER_DEPTH_MAX = 10;

// The folders a link is in, outermost first: each <DL> list around it has
// its folder's <H3> right before it. The browser's own folders are skipped.
function folderPathOf(link: Element): string[] {
  const path: string[] = [];
  let list = link.closest("dl");
  while (list) {
    const heading = list.previousElementSibling;
    if (heading?.tagName === "H3" && !isBuiltInFolder(heading)) {
      const name = heading.textContent?.trim();
      if (name) path.unshift(name);
    }
    list = list.parentElement?.closest("dl") ?? null;
  }
  return path;
}

// Reads a bookmarks file from Chrome, Safari, Firefox, Raindrop or Linkwell.
// Runs in the browser (DOMParser), so the file never has to be uploaded whole.
// Only http and https links are kept; javascript: bookmarklets and the like are skipped.
export function parseBookmarksHtml(html: string): ImportedBookmark[] {
  const page = new DOMParser().parseFromString(html, "text/html");
  const bookmarks: ImportedBookmark[] = [];

  for (const a of page.querySelectorAll("a[href]")) {
    const url = a.getAttribute("href")!.trim();
    if (!isWebAddress(url)) continue;

    const seconds = Number(a.getAttribute("add_date"));
    const path = folderPathOf(a);
    bookmarks.push({
      url,
      title: a.textContent?.trim() || undefined,
      tags: (a.getAttribute("tags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      folder: path.at(-1),
      folderPath: path,
      addDate: seconds > 0 ? new Date(seconds * 1000).toISOString() : undefined,
    });
  }

  return bookmarks;
}

// How many bookmarks the browser sends in one request. A big file goes in
// several batches, so each request stays well under the 1 MB a Server Action accepts.
export const IMPORT_BATCH_SIZE = 200;

// The folder path, each name cleaned like any folder name, at most
// FOLDER_DEPTH_MAX deep. Older pages only send `folder`: one level.
function cleanFolderPath(input: ImportedBookmark): string[] {
  const names = Array.isArray(input.folderPath) ? input.folderPath : [input.folder];
  return names
    .map((name) => cleanText(name, FOLDER_NAME_MAX_LENGTH))
    .filter((name): name is string => Boolean(name))
    .slice(0, FOLDER_DEPTH_MAX);
}

// Checks one bookmark the browser sent. Server Actions are public, so nothing
// here is trusted: wrong types, huge texts, odd links and future dates are
// fixed or refused (null).
export function cleanBookmark(
  input: ImportedBookmark,
  now = new Date()
): ImportedBookmark | null {
  const url = typeof input?.url === "string" ? input.url.trim() : "";
  if (url.length > URL_MAX_LENGTH || !isWebAddress(url)) return null;

  return {
    url,
    title: cleanText(input.title, TITLE_MAX_LENGTH),
    tags: cleanTags(input.tags),
    folder: cleanText(input.folder, FOLDER_NAME_MAX_LENGTH),
    folderPath: cleanFolderPath(input),
    addDate: cleanDate(input.addDate, now),
  };
}
