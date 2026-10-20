import { getDomain, parseTags } from "@/lib/links";
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
// (<H3> followed by their own <DL> list); links without a folder come last.
export function toBookmarksHtml(links: Link[], folders: Folder[]): string {
  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Linkwell</H1>",
    "<DL><p>",
  ];

  for (const folder of folders) {
    lines.push(`    <DT><H3>${escapeHtml(folder.name)}</H3>`);
    lines.push("    <DL><p>");
    for (const link of links.filter((l) => l.folderId === folder.id)) {
      lines.push(bookmarkLine(link, "        "));
    }
    lines.push("    </DL><p>");
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

// The folder a link is in: the <H3> right before the <DL> list around it.
function folderOf(link: Element): string | undefined {
  const list = link.closest("dl");
  const heading = list?.previousElementSibling;
  if (heading?.tagName !== "H3" || isBuiltInFolder(heading)) return undefined;
  return heading.textContent?.trim() || undefined;
}

function isWebAddress(url: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
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
    bookmarks.push({
      url,
      title: a.textContent?.trim() || undefined,
      tags: (a.getAttribute("tags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      folder: folderOf(a),
      addDate: seconds > 0 ? new Date(seconds * 1000).toISOString() : undefined,
    });
  }

  return bookmarks;
}

// How many bookmarks the browser sends in one request. A big file goes in
// several batches, so each request stays well under the 1 MB a Server Action accepts.
export const IMPORT_BATCH_SIZE = 200;

const TITLE_MAX_LENGTH = 500;
const FOLDER_MAX_LENGTH = 100;
const TAGS_MAX = 20;

function cleanText(value: unknown, maxLength: number): string | undefined {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength) || undefined
    : undefined;
}

// Checks one bookmark the browser sent. Server Actions are public, so nothing
// here is trusted: wrong types, huge texts, odd links and future dates are
// fixed or refused (null).
export function cleanBookmark(
  input: ImportedBookmark,
  now = new Date()
): ImportedBookmark | null {
  const url = typeof input?.url === "string" ? input.url.trim() : "";
  if (!isWebAddress(url)) return null;

  const tags = Array.isArray(input.tags)
    ? input.tags.filter((tag) => typeof tag === "string")
    : [];
  const date =
    typeof input.addDate === "string" ? new Date(input.addDate) : null;

  return {
    url,
    title: cleanText(input.title, TITLE_MAX_LENGTH),
    tags: parseTags(tags.join(",")).slice(0, TAGS_MAX),
    folder: cleanText(input.folder, FOLDER_MAX_LENGTH),
    addDate:
      date && !isNaN(date.getTime()) && date <= now
        ? date.toISOString()
        : undefined,
  };
}
