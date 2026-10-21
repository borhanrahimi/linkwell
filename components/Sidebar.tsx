"use client";

import { useEffect, useRef, useState } from "react";
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
  // Phones only: whether the sidebar is open as a drawer, and how to close it.
  open?: boolean;
  onClose?: () => void;
};

// The column on the left: smart lists (with the counts that used to be the
// Overview tile), folders and tags. Each one is a filter for the list.
// On phones it's a drawer instead, sliding in from the left over a dimmed page
// when the Lists button opens it; Close, Esc or a tap on the page close it.
export default function Sidebar(props: SidebarProps) {
  const {
    links,
    folders,
    activeList,
    activeFolder,
    activeTag,
    open = false,
    onClose,
  } = props;
  const closeButton = useRef<HTMLButtonElement>(null);

  // When the drawer opens, focus moves into it, and Esc closes it.
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  const { total, unread, broken } = countLinks(links);
  const folderCounts: Record<string, number> = {};
  for (const link of links) {
    if (link.folderId)
      folderCounts[link.folderId] = (folderCounts[link.folderId] ?? 0) + 1;
  }
  const tags = countTags(links);
  // The 5 most used tags, plus the chosen one; "Show all" lists the rest.
  const [allTags, setAllTags] = useState(false);
  const TOP_TAGS = 5;
  const shownTags = allTags
    ? tags
    : tags.filter(({ tag }, index) => index < TOP_TAGS || tag === activeTag);

  const lists: {
    id: SmartList;
    label: string;
    count: number;
    alert?: boolean;
  }[] = [
    { id: "all", label: "All links", count: total },
    { id: "unread", label: "Unread", count: unread },
    { id: "broken", label: "Broken", count: broken, alert: broken > 0 },
  ];

  return (
    <>
      {open && (
        <div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}
      <nav
        id="sidebar"
        aria-label="Your lists"
        className={`glass space-y-5 p-3 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:w-72 max-md:max-w-[85vw] max-md:overflow-y-auto max-md:rounded-r-2xl max-md:bg-surface md:sticky md:top-24 md:self-start md:rounded-2xl ${
          open ? "" : "max-md:hidden"
        }`}
      >
        <div className="flex items-center justify-between px-2 md:hidden">
          <span className="text-sm font-semibold text-ink">Lists</span>
          <button ref={closeButton} onClick={onClose} className="btn-quiet">
            Close
          </button>
        </div>
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
                    <span className="min-w-0 flex-1 truncate">
                      {list.label}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`text-xs ${list.alert ? "font-semibold text-danger" : "text-muted"}`}
                    >
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
          <h2
            id="folders-heading"
            className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted"
          >
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
            <h2
              id="tags-heading"
              className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted"
            >
              Tags
            </h2>
            {/* The buttons are named by the tag alone ("react"), so they don't
              clash with the #react buttons on the cards. */}
            <ul aria-label="All tags" className="space-y-0.5">
              {shownTags.map(({ tag, count }) => (
                <li key={tag}>
                  <button
                    onClick={() => props.onSelectTag(tag)}
                    aria-pressed={activeTag === tag}
                    className={`sidebar-item ${activeTag === tag ? "sidebar-item-active" : ""}`}
                  >
                    <span
                      aria-hidden="true"
                      className="w-4 text-center text-muted"
                    >
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
            {tags.length > TOP_TAGS && (
              <button onClick={() => setAllTags(!allTags)} className="sidebar-item text-muted">
                {allTags ? "Show fewer" : `Show all ${tags.length} tags`}
              </button>
            )}
          </section>
        )}
      </nav>
    </>
  );
}
