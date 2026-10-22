"use client";

import { useEffect, useRef, useState } from "react";
import FolderIcon from "@/components/FolderIcon";
import { FOLDER_COLORS, FOLDER_DOT_CLASS, FOLDER_ICONS, FOLDER_TEXT_CLASS } from "@/lib/folders";
import { FOLDER_NAME_MAX_LENGTH } from "@/lib/links";
import type { Folder, FolderColor, FolderIcon as FolderIconName } from "@/types/link";

type FolderActionsProps = {
  folder: Folder;
  onRename: (id: string, name: string) => Promise<string | null>;
  onRecolor: (id: string, color: FolderColor) => void;
  onChangeIcon: (id: string, icon: FolderIconName | null) => void;
  onDelete: (id: string) => void;
};

// Editing the selected folder. Most of the time a folder is opened to read
// it, so all that shows is a small pencil next to its name. It opens one panel
// with the name, colour and icon, and Delete; Done or Esc closes it again.
// Sits in the heading row: the pencil after the name, the panel on a row of
// its own underneath (order-last, basis-full).
export default function FolderActions({ folder, onRename, onRecolor, onChangeIcon, onDelete }: FolderActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(folder.name);
  const [error, setError] = useState<string | null>(null);
  const pencil = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  function open() {
    setName(folder.name);
    setError(null);
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    pencil.current?.focus();
  }

  // Opening moves focus into the panel; Esc closes it.
  useEffect(() => {
    if (!isOpen) return;
    heading.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        pencil.current?.focus();
      }
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    const message = await onRename(folder.id, name);
    setError(message);
  }

  function handleDelete() {
    if (window.confirm(`Delete the folder "${folder.name}"? Its links stay, just without a folder.`)) {
      onDelete(folder.id);
    }
  }

  const current = folder.color ?? "gray";
  const iconButton = (selected: boolean) =>
    `grid size-9 place-items-center rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 ${
      selected ? "bg-hover ring-1 ring-ink" : "hover:bg-hover"
    }`;
  const label = "text-xs font-semibold uppercase tracking-wide text-muted";

  return (
    <>
      <button
        ref={pencil}
        onClick={() => (isOpen ? close() : open())}
        aria-label="Edit folder"
        aria-expanded={isOpen}
        aria-controls="edit-folder"
        title="Edit folder"
        className={`grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-hover hover:text-ink focus:outline-none focus:ring-2 focus:ring-blue-400 ${
          isOpen ? "bg-hover text-ink" : ""
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
          <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z" />
          <path d="M13.5 6.5l4 4" />
        </svg>
      </button>

      {isOpen && (
        <section
          id="edit-folder"
          aria-labelledby="edit-folder-heading"
          className="glass order-last mt-2 basis-full space-y-4 rounded-2xl p-4"
        >
          <h3 id="edit-folder-heading" ref={heading} tabIndex={-1} className="font-semibold text-ink focus:outline-none">
            Edit folder
          </h3>

          <form onSubmit={handleRename} className="space-y-1">
            <label htmlFor="edit-folder-name" className={label}>
              Name
            </label>
            <div className="flex gap-2">
              <input
                id="edit-folder-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                maxLength={FOLDER_NAME_MAX_LENGTH}
                className="field min-w-0 flex-1"
              />
              <button type="submit" disabled={name.trim() === folder.name} className="btn-secondary">
                Save name
              </button>
            </div>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </form>

          <div className="space-y-1.5">
            <p className={label}>Colour</p>
            <div role="group" aria-label="Folder colour" className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onRecolor(folder.id, color)}
                  aria-label={color[0].toUpperCase() + color.slice(1)}
                  aria-pressed={color === current}
                  className={`size-6 rounded-full ${FOLDER_DOT_CLASS[color]} focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                    color === current ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className={label}>Icon</p>
            <div role="group" aria-label="Folder icon" className="flex flex-wrap gap-1">
              <button onClick={() => onChangeIcon(folder.id, null)} aria-label="Dot" aria-pressed={!folder.icon} className={iconButton(!folder.icon)}>
                <span className={`size-2.5 rounded-full ${FOLDER_DOT_CLASS[current]}`} />
              </button>
              {FOLDER_ICONS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => onChangeIcon(folder.id, icon)}
                  aria-label={`${icon[0].toUpperCase() + icon.slice(1)} icon`}
                  aria-pressed={icon === folder.icon}
                  className={iconButton(icon === folder.icon)}
                >
                  <FolderIcon name={icon} className={`size-5 ${FOLDER_TEXT_CLASS[current]}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-line pt-3">
            <button onClick={handleDelete} className="btn-quiet font-normal text-danger">
              Delete folder
            </button>
            <button onClick={close} className="btn-primary">
              Done
            </button>
          </div>
        </section>
      )}
    </>
  );
}
