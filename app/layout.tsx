import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agently — the marketplace for AI agents",
  description:
    "Upload, sell, and find AI agents by the problem they solve. Safety-reviewed before they're listed.",
};

const NAV = [
  { href: "/browse", label: "Browse" },
  { href: "/pricing", label: "Membership" },
  { href: "/dashboard/upload", label: "Upload an agent" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-ink/10">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
              <Link href="/" className="text-sm font-semibold tracking-tight">
                Agently
              </Link>
              <nav className="flex items-center gap-6 text-sm text-ink/70">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} className="hover:text-ink">
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/auth/sign-in"
                  className="rounded-full border border-ink/15 px-3 py-1.5 hover:border-ink/40 hover:text-ink"
                >
                  Sign in
                </Link>
              </nav>
            </div>
          </header>
          <div className="flex-1">{children}</div>
          <footer className="border-t border-ink/10 px-6 py-8 text-center text-xs text-ink/50">
            Agently — built by a creator who uses this catalog on their own channel first.
          </footer>
        </div>
      </body>
    </html>
  );
}
