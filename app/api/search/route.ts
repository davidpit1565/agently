import { NextResponse } from "next/server";
import { getApprovedAgents } from "@/lib/catalog";
import { getEmbedding, cosineSimilarity } from "@/lib/embeddings";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

// Semantic ranking for /browse. Returns null (not an error) whenever
// semantic matching isn't available for this query — no VOYAGE_API_KEY,
// the embedding call failed, or no listing has an embedding yet — so the
// client falls back to its existing substring filter, same "missing key
// means fall back, not break" pattern as lib/safety-review.ts.
//
// Below this similarity threshold a match is noise, not "less relevant" —
// cosine similarity on real sentence embeddings rarely drops below ~0.3
// for genuinely related text, so filtering there keeps an unrelated query
// (e.g. a name typed into the box) from returning the whole catalog sorted
// by not-quite-random order.
const MIN_SIMILARITY = 0.3;

export async function POST(request: Request) {
  const { query } = await request.json();
  if (typeof query !== "string" || !query.trim()) {
    return NextResponse.json({ ranked: null });
  }

  // This route is reachable by anyone, signed in or not, and every call
  // with a non-empty query reaches getEmbedding() below — a real Voyage AI
  // charge. With no auth to raise the cost of abuse, a script looping this
  // in a tight loop had zero friction. 30 searches/minute/IP is well above
  // anything a person typing into the search box would hit.
  const allowed = await checkRateLimit(`search:${clientIp(request)}`, 30, 60);
  if (!allowed) {
    return NextResponse.json({ ranked: null }, { status: 429 });
  }

  const queryEmbedding = await getEmbedding(query);
  if (!queryEmbedding) {
    return NextResponse.json({ ranked: null });
  }

  const agents = await getApprovedAgents();
  const scored = agents
    .filter((a) => Array.isArray(a.embedding) && a.embedding.length > 0)
    .map((a) => ({ id: a.id, score: cosineSimilarity(queryEmbedding, a.embedding as number[]) }))
    .filter((s) => s.score >= MIN_SIMILARITY)
    .sort((a, b) => b.score - a.score);

  // No embedded listing cleared the bar — most likely no agent has an
  // embedding yet (VOYAGE_API_KEY was only just added). Same fallback as
  // above: let the client's substring filter handle it, not an empty page.
  if (scored.length === 0) {
    return NextResponse.json({ ranked: null });
  }

  return NextResponse.json({ ranked: scored.map((s) => s.id) });
}
