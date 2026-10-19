"use client";

import { useState } from "react";
import type { Folder } from "@/types/link";

type FolderActionsProps = {
    folder: Folder;
    onRename: (id: string, name: string) => Promise<string | null>;
    onDelete: (id: string) => void;
};

export default function FolderActions({ folder, onRename, onDelete }: FolderActionsProps) {
    const [isRenaming, setIsRenaming] = useState(false);
    const [name, setName] = useState(folder.name);
    const [error, setError] = useState<string | null>(null);

    function startRenaming() {
        setName(folder.name);
        setError(null);
        setIsRenaming(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const message = await onRename(folder.id, name);
        if (message) {
            setError(message);
            return;
        }
        setIsRenaming(false);
    }

    function handleDelete() {
        if (window.confirm(`Delete the folder "${folder.name}"? Its links stay, just without a folder.`)) {
            onDelete(folder.id);
        }
    }

    if (isRenaming) {
        return (
            <div className="mt-2">
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value);
                            setError(null);
                        }}
                        aria-label="New folder name"
                        autoFocus
                        className="field min-w-0 flex-1"
                    />
                    <button type="submit" className="btn-secondary">
                        Rename
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsRenaming(false)}
                        className="btn-quiet"
                    >
                        Cancel
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

    return (
        <div className="mt-2 flex gap-3 text-sm">
            <button onClick={startRenaming} className="text-slate-600 hover:text-slate-800">
                Rename folder
            </button>
            <button onClick={handleDelete} className="text-slate-600 hover:text-red-600">
                Delete folder
            </button>
        </div>
    );
}
