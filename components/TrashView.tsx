"use client";

import FolderIconDrawing from "@/components/FolderIcon";
import { Favicon } from "@/components/LinkParts";
import EmptyTrash from "@/components/illustrations/EmptyTrash";
import { FOLDER_DOT_CLASS, FOLDER_TEXT_CLASS } from "@/lib/folders";
import { getDomain, timeAgo, trashDaysLeft } from "@/lib/links";
import { TRASH_DAYS } from "@/lib/limits";
import type { Folder, Link } from "@/types/link";

type TrashViewProps = {
  links: Link[];
  folders: Folder[];
  now?: Date;
  onRestoreLink: (id: string) => void;
  onRestoreFolder: (id: string) => void;
  onDeleteForever: (item: { linkId?: string; folderId?: string; name: string }) => void;
  onEmpty: () => void;
};

type Item = { kind: "link"; link: Link } | { kind: "folder"; folder: Folder };

function deletedAt(item: Item) {
  return (item.kind === "link" ? item.link.deletedAt : item.folder.deletedAt) ?? "";
}

// The Trash: deleted links and folders, newest first, each with how long it
// has left. Restore puts it back; Delete forever and Empty trash ask first.
export default function TrashView({ links, folders, now, onRestoreLink, onRestoreFolder, onDeleteForever, onEmpty }: TrashViewProps) {
  const items: Item[] = [
    ...folders.map((folder) => ({ kind: "folder" as const, folder })),
    ...links.map((link) => ({ kind: "link" as const, link })),
  ].sort((a, b) => deletedAt(b).localeCompare(deletedAt(a)));

  function emptyTrash() {
    const things = items.length === 1 ? "the 1 thing" : `all ${items.length} things`;
    if (window.confirm(`Delete ${things} in the Trash forever? This can't be undone.`)) onEmpty();
  }

  return (
    <section aria-labelledby="trash-heading">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="trash-heading" className="text-xl font-semibold text-ink">
          Trash
        </h2>
        <span className="ml-auto text-sm text-muted">
          {items.length === 1 ? "1 item" : `${items.length} items`}
        </span>
        {items.length > 0 && (
          <button onClick={emptyTrash} className="btn-secondary text-danger">
            Empty trash
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">Deleted things stay here for {TRASH_DAYS} days, then they&apos;re gone for good.</p>

      {items.length === 0 ? (
        <div className="mt-6 text-center">
          <EmptyTrash className="mx-auto w-48" />
          <p className="mt-2 text-muted">Nothing in the Trash.</p>
        </div>
      ) : (
        <ul aria-label="In the Trash" className="glass mt-4 divide-y divide-line rounded-2xl">
          {items.map((item) => {
            const when = deletedAt(item);
            const left = trashDaysLeft(when, now);
            const name = item.kind === "link" ? item.link.title || getDomain(item.link.url) : item.folder.name;
            const color = item.kind === "folder" ? (item.folder.color ?? "gray") : "gray";
            return (
              <li
                key={item.kind === "link" ? item.link.id : item.folder.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
              >
                {item.kind === "link" ? (
                  <Favicon url={item.link.url} size="small" />
                ) : item.folder.icon ? (
                  <FolderIconDrawing name={item.folder.icon} className={`size-5 shrink-0 ${FOLDER_TEXT_CLASS[color]}`} />
                ) : (
                  <span aria-hidden="true" className={`mx-1 size-3 shrink-0 rounded-full ${FOLDER_DOT_CLASS[color]}`} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">
                    {item.kind === "folder" && <span className="sr-only">Folder: </span>}
                    {name}
                  </p>
                  <p className="text-xs text-muted">
                    {item.kind === "folder" ? "Folder · " : `${getDomain(item.link.url)} · `}
                    Deleted <span suppressHydrationWarning>{timeAgo(when, now)}</span> ·{" "}
                    {left === 1 ? "1 day left" : `${left} days left`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1 max-sm:w-full max-sm:pl-8">
                  <button
                    onClick={() => (item.kind === "link" ? onRestoreLink(item.link.id) : onRestoreFolder(item.folder.id))}
                    aria-label={`Restore ${name}`}
                    className="btn-secondary"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() =>
                      onDeleteForever(
                        item.kind === "link" ? { linkId: item.link.id, name } : { folderId: item.folder.id, name }
                      )
                    }
                    aria-label={`Delete ${name} forever`}
                    className="btn-quiet font-normal text-danger"
                  >
                    Delete forever
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
