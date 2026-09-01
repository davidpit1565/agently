/**
 * Semantic matching for /browse — the gap the About page names outright
 * ("search today is real text matching, not that"). Uses Voyage AI
 * (Anthropic's recommended embeddings provider; Anthropic itself doesn't
 * serve an embeddings endpoint) to turn a listing's buyer-facing text and
 * a search query into vectors, then ranks by cosine similarity.
 *
 * Same fallback pattern as lib/safety-review.ts: no VOYAGE_API_KEY means
 * every caller gets null back and falls back to substring matching, not
 * an error.
 */

const VOYAGE_MODEL = "voyage-3.5";

export async function getEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey || !text.trim()) return null;

  try {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: [text], model: VOYAGE_MODEL }),
      // Without an explicit deadline, a hung Voyage API left the calling
      // request (agent upload/edit, or /api/search) open with no response
      // instead of falling back to substring matching within a few seconds.
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const embedding = json?.data?.[0]?.embedding;
    return Array.isArray(embedding) ? embedding : null;
  } catch {
    // Network failure, timeout, malformed response — same as "no key
    // configured" from the caller's point of view: fall back, don't 500.
    return null;
  }
}

/** The text a listing is matched against — same fields the old keyword
 *  search used (lib/requests.ts findSimilarAgents), so semantic search
 *  replaces that comparison on equal footing, not a different question. */
export function embeddableText(agent: { name: string; tagline: string; problem_solved: string }): string {
  return `${agent.name}. ${agent.tagline}. ${agent.problem_solved}`;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
