"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { TITLE_MAX_LENGTH, URL_MAX_LENGTH } from "@/lib/links";
import { findSharedUrl } from "@/lib/share";
import FolderPicker from "@/components/FolderPicker";
import type { Folder } from "@/types/link";

// Whether this browser lets a page read the clipboard. It never changes, so
// there's nothing to subscribe to. The server can't know and says false; React
// then asks the browser after hydration, so both first renders match.
const noSubscription = () => () => {};
const browserCanPaste = () => typeof navigator.clipboard?.readText === "function";
const serverCanPaste = () => false;

type LinkFormProps = {
  onAdd: (url: string, title: string, tags: string, folderId: string) => Promise<string | null>;
  folders?: Folder[];
  // The folder being looked at: new links go there unless you pick another.
  currentFolder?: string | null;
  onCreateFolder?: (name: string) => Promise<Folder | string>;
};

export default function LinkForm({ onAdd, folders = [], currentFolder = null, onCreateFolder }: LinkFormProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [chosenFolder, setChosenFolder] = useState<string | null>(null);
  const folderId = chosenFolder ?? currentFolder ?? "";
  const [error, setError] = useState<string | null>(null);
  const canPaste = useSyncExternalStore(noSubscription, browserCanPaste, serverCanPaste);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  async function pasteLink() {
    try {
      // Browsers only allow this right after a tap or click, and may ask first,
      // so a website can't read what you copied behind your back.
      const link = findSharedUrl(await navigator.clipboard.readText());
      if (link) {
        setUrl(link);
        setError(null);
      } else {
        setError("There's no link on your clipboard.");
      }
    } catch {
      setError("Linkwell can't read your clipboard. Paste the link into the box instead.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    // Remember what was sent: saving can take a few seconds (the server may
    // fetch the page title), and you may start typing the next link meanwhile.
    const sent = { url, title, tags };
    const message = await onAdd(url.trim(), title, tags, folderId);
    if (message) {
      setError(message);
      return;
    }

    // Only clear what is still the saved link, never what you typed since.
    setUrl((current) => (current === sent.url ? "" : current));
    setTitle((current) => (current === sent.title ? "" : current));
    setTags((current) => (current === sent.tags ? "" : current));
    // The next link goes to the folder being looked at again.
    setChosenFolder(null);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex min-w-0 gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            placeholder="Paste a link..."
            maxLength={URL_MAX_LENGTH}
            className="field min-w-0 flex-1"
          />
          {canPaste && (
            <button type="button" onClick={pasteLink} className="btn-secondary">
              Paste
            </button>
          )}
          <button type="submit" className="btn-primary">
            Save
          </button>
        </div>
        {/* Title and tags only appear once there's a link, so the bar stays slim. */}
        {url && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              maxLength={TITLE_MAX_LENGTH}
              className="field min-w-0 flex-1"
            />
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags, comma separated"
              className="field min-w-0 flex-1"
            />
            {onCreateFolder && (
              <FolderPicker folders={folders} value={folderId} onChange={setChosenFolder} onCreate={onCreateFolder} />
            )}
          </div>
        )}
      </form>
      {error && (
        <p role="alert" className="mt-2 px-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
