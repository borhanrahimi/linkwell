"use client";

import CheckLinksButton from "@/components/CheckLinksButton";
import FolderBar from "@/components/FolderBar";
import { countLinks, countTags, type SmartList } from "@/lib/links";
import type { Folder, Link } from "@/types/link";

type SidebarProps = {
  links: Link[];
  folders: Folder[];
  activeList: SmartList;
  activeFolder: string | null;
  activeTag: string | null;
  onSelectList: (list: SmartList) => void;
  onSelectFolder: (folderId: string | null) => void;
  onSelectTag: (tag: string) => void;
  onCreateFolder: (name: string) => Promise<string | null>;
  onChecked: (links: Link[]) => void;
};

// The column on the left: smart lists (with the counts that used to be the
// Overview tile), folders and tags. Each one is a filter for the list.
export default function Sidebar(props: SidebarProps) {
  const { links, folders, activeList, activeFolder, activeTag } = props;
  const { total, unread, broken } = countLinks(links);
  const folderCounts: Record<string, number> = {};
  for (const link of links) {
    if (link.folderId) folderCounts[link.folderId] = (folderCounts[link.folderId] ?? 0) + 1;
  }
  const tags = countTags(links);

  const lists: { id: SmartList; label: string; count: number; alert?: boolean }[] = [
    { id: "all", label: "All links", count: total },
    { id: "unread", label: "Unread", count: unread },
    { id: "broken", label: "Broken", count: broken, alert: broken > 0 },
  ];

  return (
    <nav aria-label="Your lists" className="glass space-y-5 rounded-2xl p-3 md:sticky md:top-24 md:self-start">
      <div>
        <ul aria-label="Lists" className="space-y-0.5">
          {lists.map((list) => {
            // A smart list only counts as chosen while no folder is.
            const active = activeList === list.id && !activeFolder;
            return (
              <li key={list.id}>
                <button
                  onClick={() => props.onSelectList(list.id)}
                  aria-pressed={active}
                  className={`sidebar-item ${active ? "sidebar-item-active" : ""}`}
                >
                  <span className="min-w-0 flex-1 truncate">{list.label}</span>
                  <span aria-hidden="true" className={`text-xs ${list.alert ? "font-semibold text-danger" : "text-muted"}`}>
                    {list.count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {total > 0 && (
          <div className="px-2">
            <CheckLinksButton onChecked={props.onChecked} />
          </div>
        )}
      </div>

      <section aria-labelledby="folders-heading">
        <h2 id="folders-heading" className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Folders
        </h2>
        <FolderBar
          folders={folders}
          counts={folderCounts}
          activeFolder={activeFolder}
          onSelect={props.onSelectFolder}
          onCreate={props.onCreateFolder}
        />
      </section>

      {tags.length > 0 && (
        <section aria-labelledby="tags-heading">
          <h2 id="tags-heading" className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Tags
          </h2>
          {/* The buttons are named by the tag alone ("react"), so they don't
              clash with the #react buttons on the cards. */}
          <ul aria-label="All tags" className="space-y-0.5">
            {tags.map(({ tag, count }) => (
              <li key={tag}>
                <button
                  onClick={() => props.onSelectTag(tag)}
                  aria-pressed={activeTag === tag}
                  className={`sidebar-item ${activeTag === tag ? "sidebar-item-active" : ""}`}
                >
                  <span aria-hidden="true" className="w-4 text-center text-muted">
                    #
                  </span>
                  <span className="min-w-0 flex-1 truncate">{tag}</span>
                  <span aria-hidden="true" className="text-xs text-muted">
                    {count}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </nav>
  );
}
