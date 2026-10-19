"use client";

import { useEffect, useState } from "react";

type LinkFormProps = {
  onAdd: (url: string, title: string, tags: string) => Promise<string | null>;
};

export default function LinkForm({ onAdd }: LinkFormProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    // Remember what was sent: saving can take a few seconds (the server may
    // fetch the page title), and you may start typing the next link meanwhile.
    const sent = { url, title, tags };
    const message = await onAdd(url.trim(), title, tags);
    if (message) {
      setError(message);
      return;
    }

    // Only clear what is still the saved link, never what you typed since.
    setUrl((current) => (current === sent.url ? "" : current));
    setTitle((current) => (current === sent.title ? "" : current));
    setTags((current) => (current === sent.tags ? "" : current));
  }

  return (
    <div className="mt-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 lg:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          placeholder="Paste a link..."
          className="field min-w-0 flex-1"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="field min-w-0 flex-1"
        />
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags, comma separated"
          className="field min-w-0 flex-1"
        />

        <button type="submit" className="btn-primary">
          Save
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
