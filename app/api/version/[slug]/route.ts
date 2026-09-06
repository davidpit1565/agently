import { NextResponse } from "next/server";
import { getAgentBySlug } from "@/lib/catalog";
import { SITE_URL } from "@/lib/site";

// Public, unauthenticated, no CORS restriction — meant to be pinged by the
// delivered agent's own code, not the Agently website. A standalone script
// someone downloaded has no reason to ever load agently again on its own;
// this is the one thing that can actually reach it. See CHECKING-FOR-UPDATES.md
// for the snippet creators can drop into what they deliver.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agent = await getAgentBySlug(slug);

  if (!agent || agent.status !== "approved") {
    return NextResponse.json({ error: "No agent at that slug." }, { status: 404 });
  }

  return NextResponse.json(
    {
      slug: agent.slug,
      name: agent.name,
      version: agent.version,
      updated_at: agent.updated_at,
      page_url: `${SITE_URL}/agents/${agent.slug}`,
    },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } }
  );
}
