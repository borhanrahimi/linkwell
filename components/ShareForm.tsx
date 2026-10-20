"use client";

import { useState } from "react";
import NextLink from "next/link";
import { saveLink } from "@/app/actions";
import { createLink, getDomain, parseTags } from "@/lib/links";

// Saving waits for a click instead of happening when the page opens: any
// website could open /share?url=... in your browser, and that alone must
// never add links to your account.
export default function ShareForm({ url, title }: { url: string; title: string }) {
  const [titleInput, setTitleInput] = useState(title);
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = await saveLink(createLink(url, titleInput, parseTags(tags)));
    setSaving(false);
    if (typeof result === "string") {
      setMessage(result);
    } else {
      setSaved(true);
    }
  }

  if (saved) {
    return (
      <div role="status">
        <p className="mt-4 text-ink">Saved to Linkwell.</p>
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
      {message && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
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
