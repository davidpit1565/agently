import { NextResponse } from "next/server";
import { getApprovedAgents } from "@/lib/catalog";
import { findSimilarAgents } from "@/lib/requests";

// Plain keyword matching, not semantic search (see lib/requests.ts) —
// lets the request form show "does this already exist?" before someone
// submits a request for something already in the catalog.
export async function POST(request: Request) {
  const { description } = await request.json();
  if (!description || typeof description !== "string") {
    return NextResponse.json({ matches: [] });
  }

  const agents = await getApprovedAgents();
  const matches = findSimilarAgents(description, agents);

  return NextResponse.json({
    matches: matches.map((a) => ({ slug: a.slug, name: a.name, tagline: a.tagline })),
  });
}
