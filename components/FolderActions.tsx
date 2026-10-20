"use client";

import { useState } from "react";
import FolderIcon from "@/components/FolderIcon";
import { FOLDER_COLORS, FOLDER_DOT_CLASS, FOLDER_ICONS, FOLDER_TEXT_CLASS } from "@/lib/folders";
import type { Folder, FolderColor, FolderIcon as FolderIconName } from "@/types/link";

type FolderActionsProps = {
    folder: Folder;
    onRename: (id: string, name: string) => Promise<string | null>;
    onRecolor: (id: string, color: FolderColor) => void;
    onChangeIcon: (id: string, icon: FolderIconName | null) => void;
    onDelete: (id: string) => void;
};

export default function FolderActions({ folder, onRename, onRecolor, onChangeIcon, onDelete }: FolderActionsProps) {
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
                    <p role="alert" className="mt-2 text-sm text-danger">
                        {error}
                    </p>
                )}
            </div>
        );
    }

    const current = folder.color ?? "gray";
    const iconButton = (selected: boolean) =>
        `grid size-8 place-items-center rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 ${
            selected ? "bg-hover ring-1 ring-ink" : "hover:bg-hover"
        }`;

    return (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <div role="group" aria-label="Folder icon" className="flex w-full flex-wrap gap-1">
                <button onClick={() => onChangeIcon(folder.id, null)} aria-label="Dot" aria-pressed={!folder.icon} className={iconButton(!folder.icon)}>
                    <span className={`size-2.5 rounded-full ${FOLDER_DOT_CLASS[current]}`} />
                </button>
                {FOLDER_ICONS.map((icon) => (
                    <button
                        key={icon}
                        onClick={() => onChangeIcon(folder.id, icon)}
                        aria-label={`${icon[0].toUpperCase() + icon.slice(1)} icon`}
                        aria-pressed={icon === folder.icon}
                        className={iconButton(icon === folder.icon)}
                    >
                        <FolderIcon name={icon} className={`size-5 ${FOLDER_TEXT_CLASS[current]}`} />
                    </button>
                ))}
            </div>
            <div role="group" aria-label="Folder colour" className="flex gap-1.5">
                {FOLDER_COLORS.map((color) => (
                    <button
                        key={color}
                        onClick={() => onRecolor(folder.id, color)}
                        aria-label={color[0].toUpperCase() + color.slice(1)}
                        aria-pressed={color === current}
                        className={`size-5 rounded-full ${FOLDER_DOT_CLASS[color]} focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                            color === current ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
                        }`}
                    />
                ))}
            </div>
            <div className="flex gap-3">
                <button onClick={startRenaming} className="text-muted hover:text-ink">
                    Rename folder
                </button>
                <button onClick={handleDelete} className="text-muted hover:text-danger">
                    Delete folder
                </button>
            </div>
        </div>
    );
}
