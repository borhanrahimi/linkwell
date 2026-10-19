import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Linkwell",
  description: "Save links. Keep them alive. Actually come back to them.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-canvas">{children}</body>
    </html>
  );
}
