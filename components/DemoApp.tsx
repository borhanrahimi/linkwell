"use client";

import { useState } from "react";
import LinkManager from "@/components/LinkManager";
import { LinkActionsProvider } from "@/components/LinkActions";
import SignInButton from "@/components/SignInButton";
import { DEMO_FOLDERS, demoLinks, makeDemoActions } from "@/lib/demo";

// The demo: the real links page with sample links, where every change stays
// in this browser tab (the demo's actions never reach the server). The top
// bar says so, with a way to start for real.
export default function DemoApp({ now }: { now: Date }) {
  // Made once, so folder names are remembered while the page is open.
  const [actions] = useState(() => makeDemoActions());

  return (
    <LinkActionsProvider actions={actions}>
      <LinkManager
        initialLinks={demoLinks(now)}
        initialFolders={DEMO_FOLDERS}
        now={now}
        topBarEnd={
          <>
            <span
              title="Try anything: nothing is saved, and a refresh starts over."
              className="rounded-full bg-highlight/15 px-2.5 py-1 text-xs font-semibold text-highlight"
            >
              Demo
            </span>
            <SignInButton label="Sign in to start" className="btn-primary" />
          </>
        }
      />
    </LinkActionsProvider>
  );
}
