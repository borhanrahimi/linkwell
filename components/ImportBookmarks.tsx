"use client";

import { useState } from "react";
import NextLink from "next/link";
import { importBookmarks } from "@/app/actions";
import { IMPORT_BATCH_SIZE, parseBookmarksHtml } from "@/lib/bookmarks";
import type { ImportedBookmark } from "@/types/link";

// Bookmarks files are rarely more than a few MB; anything much bigger is
// probably the wrong file, and reading it would freeze the page.
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type Step =
  | { name: "choose"; error?: string }
  | { name: "preview"; bookmarks: ImportedBookmark[] }
  | { name: "importing"; done: number; total: number }
  | { name: "finished"; added: number; skipped: number; error?: string };

export default function ImportBookmarks() {
  const [step, setStep] = useState<Step>({ name: "choose" });

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setStep({ name: "choose", error: "That file is too big for a bookmarks file (over 10 MB)." });
      return;
    }
    const bookmarks = parseBookmarksHtml(await file.text());
    if (bookmarks.length === 0) {
      setStep({ name: "choose", error: "No links found in that file. Choose a bookmarks file exported from your browser." });
      return;
    }
    setStep({ name: "preview", bookmarks });
  }

  async function startImport(bookmarks: ImportedBookmark[]) {
    let added = 0;
    let skipped = 0;
    // Send the links in small batches, one after another, and show progress.
    for (let start = 0; start < bookmarks.length; start += IMPORT_BATCH_SIZE) {
      setStep({ name: "importing", done: start, total: bookmarks.length });
      try {
        const result = await importBookmarks(bookmarks.slice(start, start + IMPORT_BATCH_SIZE));
        if (typeof result === "string") {
          // Too many batches this hour: stop and say how far it got.
          setStep({ name: "finished", added, skipped, error: result });
          return;
        }
        added += result.added;
        skipped += result.skipped;
      } catch {
        setStep({
          name: "finished",
          added,
          skipped,
          error: "Something went wrong, so the import stopped. Try again: links that are already saved will be skipped.",
        });
        return;
      }
    }
    setStep({ name: "finished", added, skipped });
  }

  if (step.name === "preview") {
    const folders = new Set(step.bookmarks.map((b) => b.folder).filter(Boolean)).size;
    return (
      <div className="mt-3">
        <p role="status" className="text-sm text-ink">
          Found {count(step.bookmarks.length, "link")}
          {folders > 0 && ` in ${count(folders, "folder")}`}. Links you already saved will be skipped.
        </p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => startImport(step.bookmarks)} className="btn-primary">
            Import {count(step.bookmarks.length, "link")}
          </button>
          <button onClick={() => setStep({ name: "choose" })} className="btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (step.name === "importing") {
    return (
      <p role="status" className="mt-3 text-sm text-ink">
        Importing... {step.done} of {step.total}
      </p>
    );
  }

  if (step.name === "finished") {
    return (
      <div className="mt-3">
        <p role="status" className="text-sm text-ink">
          Imported {count(step.added, "link")}.
          {step.skipped > 0 && ` Skipped ${step.skipped} (already saved, or not a web address).`}
        </p>
        {step.error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {step.error}
          </p>
        )}
        <NextLink href="/" className="btn-primary mt-3 inline-block">
          Go to my links
        </NextLink>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <label className="btn-secondary inline-block cursor-pointer focus-within:ring-2 focus-within:ring-blue-400">
        Choose bookmarks file
        <input
          type="file"
          accept=".html,.htm,text/html"
          onChange={(e) => readFile(e.target.files?.[0])}
          className="sr-only"
        />
      </label>
      {step.error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {step.error}
        </p>
      )}
    </div>
  );
}

function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
