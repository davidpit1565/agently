import { getApprovedAgents } from "@/lib/catalog";
import { BrowseClient } from "./browse-client";

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
