import type { Metadata } from "next";
import "./globals.css";
import { SITE } from "@/lib/site";

// What browsers, search engines and chat apps show for Linkwell. The preview
// picture is app/opengraph-image.png (and twitter-image.png): Next.js adds it
// to every page by itself.
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  // A page's own title becomes "Privacy · Linkwell"; the home page is just "Linkwell".
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.description,
    url: "/",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-canvas">{children}</body>
    </html>
  );
}
