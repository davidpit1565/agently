import type { Metadata } from "next";
import { getApprovedAgents } from "@/lib/catalog";
import { BrowseClient } from "./browse-client";

const title = "Browse agents — Agently";
const description = "Every AI agent in the catalog, found by the problem it solves — not a category or a keyword.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default async function BrowsePage() {
  const agents = await getApprovedAgents();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-8">
        <h1 className="text-balance font-display text-2xl font-semibold">Browse agents</h1>
      </div>
      <BrowseClient agents={agents} />
    </main>
  );
}
