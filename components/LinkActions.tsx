"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  checkAllLinks,
  createFolder,
  deleteFolder,
  importLinks,
  markLinksRead,
  moveLinksToFolder,
  moveToFolder,
  removeLink,
  renameFolder,
  saveLink,
  saveLinkDetails,
  saveReadStatus,
  setFolderColor,
  setFolderIcon,
} from "@/app/actions";

// What the links page asks the server to do. Components get these from
// useLinkActions() instead of importing the Server Actions themselves, so the
// demo (/demo) can hand them stand-ins that only change what's in the browser.
export const SERVER_ACTIONS = {
  checkAllLinks,
  createFolder,
  deleteFolder,
  importLinks,
  markLinksRead,
  moveLinksToFolder,
  moveToFolder,
  removeLink,
  renameFolder,
  saveLink,
  saveLinkDetails,
  saveReadStatus,
  setFolderColor,
  setFolderIcon,
};

export type LinkActions = typeof SERVER_ACTIONS;

// Without a provider (the real app), the real Server Actions.
const LinkActionsContext = createContext<LinkActions>(SERVER_ACTIONS);

export function LinkActionsProvider({ actions, children }: { actions: LinkActions; children: ReactNode }) {
  return <LinkActionsContext value={actions}>{children}</LinkActionsContext>;
}

export function useLinkActions(): LinkActions {
  return useContext(LinkActionsContext);
}
