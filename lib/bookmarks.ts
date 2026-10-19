import { getDomain } from "@/lib/links";
import type { Folder, Link } from "@/types/link";

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
  const tags = link.tags && link.tags.length > 0 ? ` TAGS="${escapeHtml(link.tags.join(","))}"` : "";
  const title = escapeHtml(link.title || getDomain(link.url));
  return `${indent}<DT><A HREF="${escapeHtml(link.url)}" ADD_DATE="${addDate}"${tags}>${title}</A>`;
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
  for (const link of links.filter((l) => !l.folderId || !folderIds.has(l.folderId))) {
    lines.push(bookmarkLine(link, "    "));
  }

  lines.push("</DL><p>");
  return lines.join("\n") + "\n";
}
