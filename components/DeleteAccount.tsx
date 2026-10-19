"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

// Typing a word on purpose is harder to do by accident than clicking "OK".
export const CONFIRM_WORD = "delete";

export default function DeleteAccount() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsNewSignIn, setNeedsNewSignIn] = useState(false);
  const confirmed = typed.trim().toLowerCase() === CONFIRM_WORD;

  function close() {
    setIsOpen(false);
    setTyped("");
    setError(null);
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);
    // Better Auth deletes the user; the database then deletes their links and
    // folders too (ON DELETE CASCADE), and the session cookie is removed.
    const { error } = await authClient.deleteUser();
    if (error) {
      setIsDeleting(false);
      if (error.code === "SESSION_EXPIRED") {
        setNeedsNewSignIn(true);
        setError("For your safety, please sign in again before deleting your account.");
      } else {
        setError("Something went wrong. Your account was not deleted.");
      }
      return;
    }

    router.push("/?deleted=1");
    router.refresh();
  }

  return (
    <div>
      <h2 className="text-sm font-medium text-danger">Delete your account</h2>
      <p className="text-sm text-muted">
        This deletes your account and all your links and folders, and it can&apos;t be undone. Download your bookmarks
        file first if you want to keep them.
      </p>

      {!isOpen ? (
        <button onClick={() => setIsOpen(true)} className="btn-danger mt-3">
          Delete my account…
        </button>
      ) : (
        <form onSubmit={handleDelete} className="mt-3">
          <label htmlFor="confirm-delete" className="text-sm text-ink">
            Type <strong>{CONFIRM_WORD}</strong> to confirm
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="confirm-delete"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoFocus
              className="field min-w-0 flex-1"
            />
            <button type="submit" disabled={!confirmed || isDeleting} className="btn-danger">
              {isDeleting ? "Deleting..." : "Delete forever"}
            </button>
            <button type="button" onClick={close} className="btn-quiet">
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {needsNewSignIn && (
        <button
          onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/account" })}
          className="btn-secondary mt-2"
        >
          Sign in again
        </button>
      )}
    </div>
  );
}
