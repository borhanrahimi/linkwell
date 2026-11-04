"use client";

import { useState } from "react";
import NextLink from "next/link";
import { createFolder, restoreLinkByUrl, saveLink } from "@/app/actions";
import FolderPicker, { useLastFolder } from "@/components/FolderPicker";
import { createLink, getDomain, IN_TRASH, parseTags, TITLE_MAX_LENGTH } from "@/lib/links";
import type { Folder } from "@/types/link";

// Saving waits for a click instead of happening when the page opens: any
// website could open /share?url=... in your browser, and that alone must
// never add links to your account.
export default function ShareForm({
  url,
  title,
  initialFolders = [],
}: {
  url: string;
  title: string;
  initialFolders?: Folder[];
}) {
  const [titleInput, setTitleInput] = useState(title);
  const [folders, setFolders] = useState(initialFolders);
  // Until you pick one, the folder you saved to last time (if it still exists).
  const [lastFolder, rememberFolder] = useLastFolder();
  const [chosenFolder, setChosenFolder] = useState<string | null>(null);
  const folderId = chosenFolder ?? (folders.some((folder) => folder.id === lastFolder) ? lastFolder : "");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Saved before and now in the Trash: restored instead of saved again.
  const [restored, setRestored] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const link = { ...createLink(url, titleInput, parseTags(tags)), folderId: folderId || undefined };
    const result = await saveLink(link);
    setSaving(false);
    if (typeof result === "string") {
      setMessage(result);
    } else {
      rememberFolder(folderId);
      setSaved(true);
    }
  }

  async function restore() {
    setSaving(true);
    const result = await restoreLinkByUrl(url);
    setSaving(false);
    if (typeof result === "string") {
      setMessage(result);
    } else {
      setRestored(true);
      setSaved(true);
    }
  }

  async function addFolder(name: string) {
    const result = await createFolder(name);
    if (typeof result !== "string") setFolders((current) => [...current, result]);
    return result;
  }

  if (saved) {
    return (
      <div role="status">
        <p className="mt-4 text-ink">
          {restored
            ? "Restored from your Trash."
            : `Saved to Linkwell${folderId ? ` in ${folders.find((folder) => folder.id === folderId)?.name}` : ""}.`}
        </p>
        <NextLink href="/" className="btn-primary mt-6 inline-block">
          Go to my links
        </NextLink>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 text-left">
      <p className="break-all text-sm text-muted">{getDomain(url)}</p>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Title
        <input
          type="text"
          value={titleInput}
          maxLength={TITLE_MAX_LENGTH}
          onChange={(e) => setTitleInput(e.target.value)}
          placeholder="Optional"
          className="field"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Tags
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Comma separated"
          className="field"
        />
      </label>
      <div className="flex flex-col gap-1 text-sm text-ink">
        <span aria-hidden="true">Folder</span>
        <FolderPicker folders={folders} value={folderId} onChange={setChosenFolder} onCreate={addFolder} />
      </div>
      {message === IN_TRASH ? (
        <p role="alert" className="flex flex-wrap items-center gap-2 text-sm text-ink">
          {message}
          <button type="button" onClick={restore} disabled={saving} className="btn-secondary py-1">
            Restore it
          </button>
        </p>
      ) : (
        message && (
          <p role="alert" className="text-sm text-danger">
            {message}
          </p>
        )
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving..." : "Save link"}
        </button>
        <NextLink href="/" className="btn-secondary">
          Cancel
        </NextLink>
      </div>
    </form>
  );
}
