import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "./components/header";

export const metadata: Metadata = {
  title: "Agently — the marketplace for AI agents",
  description:
    "Upload, sell, and find AI agents by the problem they solve. Safety-reviewed before they're listed.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col">
          <Header />
          <div className="flex-1">{children}</div>
          <footer className="border-t border-ink/10 px-6 py-8 text-center text-xs text-ink/50">
            Agently — built by a creator who uses this catalog on their own channel first.
          </footer>
        </div>
      </body>
    </html>
  );
}
