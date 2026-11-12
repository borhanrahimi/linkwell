"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { DRAG_SOURCE_CLASS, useDrag, type DragItem } from "@/components/DragAndDrop";
import FolderIconDrawing from "@/components/FolderIcon";
import { Favicon, PreviewImage } from "@/components/LinkParts";
import ListIcon from "@/components/ListIcon";
import Rediscover from "@/components/Rediscover";
import EmptyBox from "@/components/illustrations/EmptyBox";
import { childFolders, countWithInside, folderAndInside, FOLDER_COLORS, FOLDER_DOT_CLASS, FOLDER_TEXT_CLASS } from "@/lib/folders";
import { countTags, getDomain, timeAgo, type SmartList } from "@/lib/links";
import type { Folder, Link } from "@/types/link";

type HomeViewProps = {
  links: Link[];
  folders: Folder[];
  now?: Date;
  // Old unread links for the Rediscover banner.
  rediscover: Link[];
  onSelectList: (list: SmartList) => void;
  onSelectFolder: (folderId: string) => void;
  onShowDetails: (linkId: string) => void;
  // Opens "Not in a folder" in Select mode, ready to move them.
  onSortThem: () => void;
  // Phones: the Folders screen (every folder, as a tree).
  onShowFolders: () => void;
  // For the phone's More part (wide screens have these in the sidebar).
  trashCount: number;
  onSelectTag: (tag: string) => void;
};

// How many things each section shows before "See all". Unread shows one row
// on wider screens (4); phones scroll sideways through 8.
const UNREAD_SHOWN = 8;
const UNREAD_SHOWN_WIDE = 4;
const FOLDERS_SHOWN = 6;
const RECENT_SHOWN = 6;
const WEEK = 7 * 24 * 60 * 60 * 1000;

// Home's links can be picked up too, and dropped on a folder (in the
// sidebar, on Home's folder tiles, or on phones the folders that come up).
function linkItem(link: Link): DragItem {
  return { kind: "links", ids: [link.id], name: link.title || getDomain(link.url) };
}

// The greeting and the date follow the clock of the person reading, not the
// server's (which may be in another time zone), so the server says something
// neutral and the browser fills in the rest.
const noSubscription = () => () => {};
function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
function today() {
  return new Date().toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" });
}

// Home, the first screen: a few of everything instead of one long list.
// A greeting with a one-line summary (and nudges about broken or unsorted
// links), Rediscover, one row of Unread, then Recently saved and Your
// folders side by side. Empty sections hide themselves.
export default function HomeView({ links, folders, now, rediscover, onSelectList, onSelectFolder, onShowDetails, onSortThem, onShowFolders, trashCount, onSelectTag }: HomeViewProps) {
  const hello = useSyncExternalStore(noSubscription, greeting, () => "Welcome back");
  const date = useSyncExternalStore(noSubscription, today, () => "");
  const drag = useDrag();

  if (links.length === 0 && folders.length === 0) {
    return (
      <div className="mt-6 text-center">
        <EmptyBox className="mx-auto w-48" />
        <p className="mt-2 text-muted">No links yet. Add your first one above.</p>
      </div>
    );
  }

  const newest = [...links].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = newest.filter((link) => !link.readAt);
  const counts = countWithInside(folders, links);
  // Pinned folders first, then the rest in their usual order.
  const topFolders = childFolders(folders, null).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  const broken = links.filter((link) => link.status === "broken").length;
  const unsorted = links.filter((link) => !link.folderId).length;
  const tags = countTags(links);
  const thisWeek = now ? links.filter((link) => now.getTime() - new Date(link.createdAt).getTime() < WEEK).length : 0;

  const summary = [
    unread.length > 0 ? `${unread.length} unread` : "All caught up",
    ...(thisWeek > 0 ? [`${thisWeek} saved this week`] : []),
  ].join(" · ");

  return (
    <div className="space-y-8">
      <header>
        <p suppressHydrationWarning className="text-sm font-medium text-muted">
          {date}
        </p>
        <p suppressHydrationWarning className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {hello}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>{summary}</span>
          {broken > 0 && (
            <button onClick={() => onSelectList("broken")} className="rounded-full bg-danger/10 px-3 py-1 font-medium text-danger hover:bg-danger/15">
              {broken === 1 ? "1 broken link" : `${broken} broken links`}
            </button>
          )}
          {unsorted > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-hover py-0.5 pl-3 pr-0.5">
              {unsorted === 1 ? "1 not in a folder" : `${unsorted} not in a folder`}
              <button onClick={onSortThem} className="rounded-full bg-surface px-2.5 py-0.5 font-medium text-accent shadow-sm hover:underline">
                Sort them
              </button>
            </span>
          )}
        </div>
      </header>

      {now && rediscover.length > 0 && <Rediscover links={rediscover} now={now} />}

      {unread.length > 0 && (
        <Section id="home-unread" title="Unread" count={unread.length} seeAllLabel="See all unread links" onSeeAll={() => onSelectList("unread")}>
          <ul aria-label="Unread links" className={`${ROW} sm:grid-cols-2 lg:grid-cols-4`}>
            {unread.slice(0, UNREAD_SHOWN).map((link, index) => (
              <LinkTile key={link.id} link={link} onShowDetails={onShowDetails} hideWhenWide={index >= UNREAD_SHOWN_WIDE} />
            ))}
          </ul>
        </Section>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {newest.length > 0 && (
          <Section id="home-recent" title="Recently saved" seeAllLabel="See all links" onSeeAll={() => onSelectList("all")}>
            <ul aria-label="Recently saved" className="glass divide-y divide-line rounded-2xl">
              {newest.slice(0, RECENT_SHOWN).map((link) => (
                <li
                  key={link.id}
                  {...drag.dragSource(() => linkItem(link))}
                  onClick={(event) => {
                    if (!(event.target as Element).closest("a")) onShowDetails(link.id);
                  }}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 first:rounded-t-2xl last:rounded-b-2xl hover:bg-hover/50 ${DRAG_SOURCE_CLASS} ${
                    drag.item?.kind === "links" && drag.item.ids.includes(link.id) ? "opacity-40" : ""
                  }`}
                >
                  <Favicon url={link.url} size="small" />
                  <div className="min-w-0 flex-1">
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className={`block truncate font-medium hover:underline ${link.readAt ? "text-muted" : "text-accent"}`}>
                      {link.title || getDomain(link.url)}
                    </a>
                    <p className="truncate text-xs text-muted">{getDomain(link.url)}</p>
                  </div>
                  <span suppressHydrationWarning className="shrink-0 text-xs text-muted">
                    {timeAgo(link.createdAt, now)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {topFolders.length > 0 && (
          // Wide screens have every folder in the sidebar already: See all is
          // for phones. On phones folders come first: a quick row to swipe.
          <Section
            className="max-lg:order-first" id="home-folders" title="Your folders" seeAllLabel="See all folders" onSeeAll={onShowFolders} seeAllOnPhonesOnly>
            <ul aria-label="Your folders" className={`${ROW} sm:grid-cols-3 lg:grid-cols-2`}>
              {topFolders.slice(0, FOLDERS_SHOWN).map((folder) => (
                <FolderTile
                  key={folder.id}
                  folder={folder}
                  count={counts[folder.id] ?? 0}
                  // The pictures of the links inside it, folders inside included.
                  images={links
                    .filter((link) => link.image && link.folderId && folderAndInside(folders, folder.id).has(link.folderId))
                    .map((link) => link.image!)
                    .slice(0, 4)}
                  onOpen={() => onSelectFolder(folder.id)}
                />
              ))}
            </ul>
          </Section>
        )}
      </div>

      {/* Phones have no sidebar, so the rest of it lives here: the other
        lists, the Trash and your tags. */}
      <section aria-labelledby="home-more" className="md:hidden">
        <h2 id="home-more" className="mb-3 text-base font-semibold text-ink">
          More
        </h2>
        <ul aria-label="More lists" className="glass divide-y divide-line rounded-2xl">
          {(
            [
              { list: "all", label: "All links", count: links.length },
              ...(broken > 0 ? [{ list: "broken", label: "Broken", count: broken }] : []),
              ...(unsorted > 0 ? [{ list: "unsorted", label: "Not in a folder", count: unsorted }] : []),
              { list: "trash", label: "Trash", count: trashCount },
            ] as { list: SmartList; label: string; count: number }[]
          ).map((row) => (
            <li key={row.list}>
              <button onClick={() => onSelectList(row.list)} className="flex w-full items-center gap-3 px-4 py-3 text-left first:rounded-t-2xl last:rounded-b-2xl hover:bg-hover/50">
                <ListIcon list={row.list} className={`size-5 ${row.list === "broken" ? "text-danger" : "text-muted"}`} />
                <span className="flex-1 text-ink">{row.label}</span>
                {row.count > 0 && (
                  <span aria-hidden="true" className="text-sm text-muted">
                    {row.count}
                  </span>
                )}
                <span aria-hidden="true" className="text-muted">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
        {tags.length > 0 && (
          <ul aria-label="Your tags" className="mt-4 flex flex-wrap gap-2">
            {tags.map(({ tag, count }) => (
              <li key={tag}>
                <button onClick={() => onSelectTag(tag)} className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-ink">
                  <span aria-hidden="true" className="text-muted">
                    #
                  </span>
                  {tag}
                  <span aria-hidden="true" className="text-xs text-muted">
                    {count}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// Phones: one row that scrolls sideways, each tile snapping into place.
// Wider screens: a grid (each list adds its own number of columns).
const ROW = "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0";

function Section({
  className = "",
  id,
  title,
  count,
  seeAllLabel,
  onSeeAll,
  seeAllOnPhonesOnly = false,
  children,
}: {
  className?: string;
  id: string;
  title: string;
  count?: number;
  seeAllLabel: string;
  onSeeAll: () => void;
  seeAllOnPhonesOnly?: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={`min-w-0 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-ink sm:text-lg">
          {title}
          {count !== undefined && <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-semibold text-muted">{count}</span>}
        </h2>
        <button onClick={onSeeAll} aria-label={seeAllLabel} className={`text-sm font-medium text-accent hover:underline ${seeAllOnPhonesOnly ? "md:hidden" : ""}`}>
          See all
        </button>
      </div>
      {children}
    </section>
  );
}

// A colour for a site without a picture, the same one every time.
function colorFor(text: string) {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  // Gray is last in the palette; it would look like a missing picture.
  return FOLDER_COLORS[Math.abs(hash) % (FOLDER_COLORS.length - 1)];
}

function LinkTile({ link, onShowDetails, hideWhenWide }: { link: Link; onShowDetails: (id: string) => void; hideWhenWide: boolean }) {
  const domain = getDomain(link.url);
  const drag = useDrag();
  const pickedUp = drag.item?.kind === "links" && drag.item.ids.includes(link.id);
  return (
    <li
      {...drag.dragSource(() => linkItem(link))}
      onClick={(event) => {
        if (!(event.target as Element).closest("a")) onShowDetails(link.id);
      }}
      className={`glass flex w-44 shrink-0 cursor-pointer snap-start flex-col overflow-hidden rounded-2xl transition-[box-shadow,opacity] hover:shadow-lg sm:w-auto ${DRAG_SOURCE_CLASS} ${hideWhenWide ? "sm:hidden" : ""} ${pickedUp ? "opacity-40" : ""}`}
    >
      {link.image ? (
        <PreviewImage src={link.image} className="w-full" />
      ) : (
        // No picture: the site's icon on a soft colour of its own.
        <div className="relative grid aspect-[1.91/1] place-items-center">
          <div aria-hidden="true" className={`absolute inset-0 opacity-15 ${FOLDER_DOT_CLASS[colorFor(domain)]}`} />
          <Favicon url={link.url} size="large" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col p-3">
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-sm font-medium text-ink hover:text-accent hover:underline sm:text-base">
          {link.title || domain}
        </a>
        <p className="mt-auto truncate pt-1 text-xs text-muted">{domain}</p>
      </div>
    </li>
  );
}

// Like a playlist: a collage of up to four of its links' pictures, or its
// icon on its colour when it has none; then its name and count.
function FolderTile({ folder, count, images, onOpen }: { folder: Folder; count: number; images: string[]; onOpen: () => void }) {
  const color = folder.color ?? "gray";
  const drag = useDrag();
  // Links and folders can be dropped on it, and it can be picked up itself.
  const over = drag.over?.folderId === folder.id;
  const pickedUp = drag.item?.kind === "folder" && drag.item.id === folder.id;
  return (
    <li className="w-28 shrink-0 snap-start sm:w-auto">
      <button
        onClick={onOpen}
        data-drop-folder={folder.id}
        {...drag.dragSource(() => ({ kind: "folder", id: folder.id, name: folder.name }))}
        className={`group w-full text-left focus:outline-none ${DRAG_SOURCE_CLASS} ${pickedUp ? "opacity-50" : ""}`}
      >
        <div
          className={`relative aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-line transition-shadow group-hover:shadow-lg group-focus-visible:ring-2 group-focus-visible:ring-blue-400 ${
            over ? "drop-into" : ""
          }`}
        >
          {images.length > 0 ? (
            <div className={`grid size-full gap-0.5 ${images.length > 1 ? "grid-cols-2" : ""}`}>
              {images.map((src, index) => (
                <PreviewImage
                  key={src + index}
                  src={src}
                  // Three pictures: the first one takes the whole top row.
                  className={`size-full !aspect-auto ${images.length === 3 && index === 0 ? "col-span-2" : ""}`}
                />
              ))}
            </div>
          ) : (
            <>
              <div aria-hidden="true" className={`absolute inset-0 opacity-15 ${FOLDER_DOT_CLASS[color]}`} />
              <div className="relative grid size-full place-items-center">
                {folder.icon ? (
                  <FolderIconDrawing name={folder.icon} className={`size-10 ${FOLDER_TEXT_CLASS[color]}`} />
                ) : (
                  <span aria-hidden="true" className={`size-6 rounded-full ${FOLDER_DOT_CLASS[color]}`} />
                )}
              </div>
            </>
          )}
        </div>
        <span className="mt-2 flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${FOLDER_DOT_CLASS[color]}`} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink group-hover:underline">{folder.name}</span>
          {folder.pinned && (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-label="Pinned" role="img" className="size-3.5 shrink-0 text-muted">
              <path d="M15 3l6 6-3 1-4 4 1 5-2 2-4-4-5 5-1-1 5-5-4-4 2-2 5 1 4-4Z" />
            </svg>
          )}
        </span>
        <span className="block pl-3.5 text-xs text-muted">{count === 1 ? "1 link" : `${count} links`}</span>
      </button>
    </li>
  );
}
