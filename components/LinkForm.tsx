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

    const message = await onAdd(url.trim(), title, tags);
    if (message) {
      setError(message);
      return;
    }

    setUrl("");
    setTitle("");
    setTags("");
  }

  return (
    <div className="mt-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          placeholder="Paste a link..."
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags, comma separated"
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          type="submit"
          className="rounded-lg bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800"
        >
          Save
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
