import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agently — the marketplace for AI agents",
  description:
    "Upload, sell, and find AI agents by the problem they solve. Safety-reviewed before they're listed.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
