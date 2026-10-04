"use client";

import { useState } from "react";

type LinkFormProps = {
  onAdd: (url: string, title: string) => void;
};

export default function LinkForm({ onAdd }: LinkFormProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    onAdd(url.trim(), title);
    setUrl("");
    setTitle("");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-2 sm:flex-row">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
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
      <button
        type="submit"
        className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
      >
        Save
      </button>
    </form>
  );
}
