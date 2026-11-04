"use client";

import { useEffect, useRef, useState } from "react";
import CheckLinksButton from "@/components/CheckLinksButton";
import FolderBar from "@/components/FolderBar";
import { countWithInside } from "@/lib/folders";
import { countLinks, countTags, type SmartList } from "@/lib/links";
import ListIcon from "@/components/ListIcon";
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
  // How many links and folders are in the Trash.
  trashCount?: number;
  // Phones only: whether the sidebar is open as a drawer, and how to close it.
  open?: boolean;
  onClose?: () => void;
};

// The column on the left: smart lists (with the counts that used to be the
// Overview tile), folders and tags. Each one is a filter for the list.
// On phones it's a full screen instead, opened by the bottom bar's Folders
// tab; Close or Esc closes it.
export default function Sidebar(props: SidebarProps) {
  const {
    links,
    folders,
    activeList,
    activeFolder,
    activeTag,
    trashCount = 0,
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
  // A folder's count includes the links in the folders inside it.
  const folderCounts = countWithInside(folders, links);
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
    count?: number;
    alert?: boolean;
  }[] = [
    { id: "home", label: "Home" },
    { id: "all", label: "All links", count: total },
    { id: "unread", label: "Unread", count: unread },
    { id: "broken", label: "Broken", count: broken, alert: broken > 0 },
  ];

  // One row of the sidebar's lists. Counts of 0 are left out: less to read.
  function listRow(list: (typeof lists)[number] | { id: SmartList; label: string; count?: number; alert?: boolean }) {
    // A smart list only counts as chosen while no folder is.
    const active = activeList === list.id && !activeFolder;
    return (
      <li key={list.id}>
        <button
          onClick={() => props.onSelectList(list.id)}
          aria-pressed={active}
          className={`sidebar-item ${active ? "sidebar-item-active" : ""}`}
        >
          <ListIcon list={list.id} />
          <span className="min-w-0 flex-1 truncate">{list.label}</span>
          {list.count ? (
            <span aria-hidden="true" className={`text-xs ${list.alert ? "font-semibold text-danger" : "text-muted"}`}>
              {list.count}
            </span>
          ) : null}
        </button>
      </li>
    );
  }

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
        className={`glass space-y-5 p-3 max-md:fixed max-md:inset-0 max-md:z-40 max-md:overflow-y-auto max-md:rounded-none max-md:bg-surface max-md:motion-safe:animate-fade-in md:sticky md:top-24 md:self-start md:rounded-2xl ${
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
            {lists.map(listRow)}
          </ul>
          {total > 0 && <CheckLinksButton onChecked={props.onChecked} />}
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

        {/* The Trash, apart at the bottom, like in a mail app. */}
        <ul aria-label="Trash" className="border-t border-line pt-3">
          {listRow({ id: "trash", label: "Trash", count: trashCount })}
        </ul>
      </nav>
    </>
  );
}
