"use client";

import { useEffect, useRef } from "react";
import { bookmarkletCode } from "@/lib/share";

export default function Bookmarklet() {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // React refuses javascript: links written in JSX, because they are a common
    // way to sneak code into a page. This one is our own fixed code, so we set
    // it directly. window.location.origin makes it work on localhost and live.
    ref.current?.setAttribute("href", bookmarkletCode(window.location.origin));
  }, []);

  return (
    <a
      ref={ref}
      // Clicking it here would only save the account page; it's meant to be dragged.
      onClick={(e) => e.preventDefault()}
      className="btn-secondary mt-3 inline-block cursor-grab"
    >
      Save to Linkwell
    </a>
  );
}
