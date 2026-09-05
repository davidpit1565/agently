import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "./components/header";
import { Footer } from "./components/footer";
import { PageWipe } from "./components/page-wipe";
import { createClient } from "@/lib/supabase/server";
import { isPlatformOwner } from "@/lib/owner";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const title = "Agently — the catalog for AI agents";
const description =
  "Upload, sell, and find AI agents by the problem they solve. Safety-reviewed before they're listed.";

export const metadata: Metadata = {
  metadataBase: new URL("https://agently-jet.vercel.app"),
  title,
  description,
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0d0b",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let signedIn = false;
  let isAdmin = false;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = !!user;
    // isPlatformOwner is the same single-owner check /dashboard/admin/agents
    // and /dashboard/admin/requests already gate on — this only decides
    // whether the nav link is worth showing, not who can reach those pages.
    // If a real admin role is ever added, only isPlatformOwner would need
    // to change; this stays correct without touching the nav again.
    isAdmin = isPlatformOwner(user?.email);
  }

  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="console-grain">
        <PageWipe />
        {/* Keyboard users otherwise have to tab through the whole header nav
            on every single page just to reach the content. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[#04140f]"
        >
          Skip to content
        </a>
        <div className="flex min-h-screen flex-col">
          <Header signedIn={signedIn} isAdmin={isAdmin} />
          <div id="main-content" className="flex-1">{children}</div>
          <Footer />
        </div>
      </body>
    </html>
  );
}
