import type { SmartList } from "@/lib/links";

// The lists' icons: the same thin outline drawings as the bottom bar, at the
// size of a folder's icon, so every row in the sidebar lines up.
const LIST_ICONS: Record<SmartList, string> = {
  home: "M4 11l8-7 8 7v9H4Z M10 20v-5h4v5",
  all: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  unread: "M6 4h12v17l-6-4-6 4Z",
  broken: "M12 4l9 16H3Z M12 10v4 M12 17h.01",
  unsorted: "M4 13l2-8h12l2 8v6H4Z M4 13h5l1 2h4l1-2h5",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
};

export default function ListIcon({ list, className = "size-4 text-muted" }: { list: SmartList; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d={LIST_ICONS[list]} />
    </svg>
  );
}
