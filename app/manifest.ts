import type { MetadataRoute } from "next";

// Makes Linkwell installable ("Add to Home screen" / "Install app").
// share_target puts the installed app in Android's Share menu: sharing a link
// opens /share?title=...&text=...&url=..., the same page the bookmarklet,
// the Chrome extension and the iPhone Shortcut use.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Linkwell",
    short_name: "Linkwell",
    description: "Save links. Keep them alive. Actually come back to them.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f7",
    theme_color: "#f5f5f7",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Android cuts icons into its own shape (circle, squircle...), so this
      // one fills the whole square and keeps the chain inside the safe middle.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/share",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
