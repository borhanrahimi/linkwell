"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveUsername } from "@/app/actions";

type UsernameFormProps = {
  initialUsername?: string | null;
};

export default function UsernameForm({ initialUsername }: UsernameFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    const message = await saveUsername(username);
    setIsSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setSaved(true);
    // Re-render the server parts (the header shows the new @username).
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="username" className="text-sm font-medium text-ink">
        Username
      </label>
      <p className="text-sm text-muted">
        Letters, numbers and _, 3 to 20 long. It will be your address when you share folders.
      </p>
      <div className="mt-2 flex gap-2">
        <div className="field flex min-w-0 flex-1 items-center gap-0.5 focus-within:ring-2 focus-within:ring-blue-400">
          <span aria-hidden="true" className="text-muted">
            @
          </span>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError(null);
              setSaved(false);
            }}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent focus:outline-none"
          />
        </div>
        <button type="submit" disabled={isSaving} className="btn-primary">
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="mt-2 text-sm text-success">
          Saved. You&apos;re @{username.trim().replace(/^@/, "").toLowerCase()} now.
        </p>
      )}
    </form>
  );
}
