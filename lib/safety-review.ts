/**
 * The safety-review agent from the market research report (ch. 5) — first
 * real pass. Reviews a submitted listing against what it claims to do, what
 * it asks permission for, and whether the description matches, and returns
 * a genuine 0-100 trust score alongside the reasoning behind it. Nothing
 * auto-approves off this verdict today — see SAFETY_REVIEW_AUTO_APPROVE
 * below, which is the single switch a future decision to trust it would
 * flip. Needs ANTHROPIC_API_KEY — without it, callers should treat a null
 * return as "skip automated review, leave it for a human" (the existing
 * behavior), not as an error.
 */

export type SafetyVerdict = {
  score: number;
  risk: "low" | "medium" | "high";
  flags: string[];
  summary: string;
};

// Flip to "true" once the score above has a track record worth trusting on
// its own. Until then every submission waits in pending_review for a human
// regardless of what the model returns — see both call sites' use of
// isAutoApproveEnabled().
export function isAutoApproveEnabled(): boolean {
  return process.env.SAFETY_REVIEW_AUTO_APPROVE === "true";
}

const REVIEW_TOOL = {
  name: "submit_review",
  description: "Submit the safety review verdict for this agent listing.",
  input_schema: {
    type: "object",
    properties: {
      score: {
        type: "integer",
        description:
          "A precise trust score from 0 (actively dangerous or deceptive) to 100 (fully trustworthy, clearly and narrowly scoped). Judge each listing on its own merits — do not round to convenient buckets like 0/25/50/75/100. Two listings that are both broadly fine should still land at different scores if one is more precisely described than the other.",
      },
      risk: {
        type: "string",
        enum: ["low", "medium", "high"],
        description:
          "low: routine tool, no concerning access or claims. medium: asks for meaningful permissions/data access that need a human to confirm the listing is honest about it. high: claims or implied behavior that could cause real harm (credential exfiltration, deceptive framing, requests access unrelated to the stated purpose).",
      },
      flags: {
        type: "array",
        items: { type: "string" },
        description: "Specific concerns, if any — empty array if none.",
      },
      summary: {
        type: "string",
        description: "One or two sentences a human reviewer or buyer can read as the review note.",
      },
    },
    required: ["score", "risk", "flags", "summary"],
  },
};

export async function reviewAgentSubmission(input: {
  name: string;
  tagline: string;
  problemSolved: string;
  description: string;
  deliveryUrl: string | null;
}): Promise<SafetyVerdict | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = `Review this AI agent catalog listing before it goes live. Judge only what's written here — you cannot run the agent's actual code.

Name: ${input.name}
Tagline: ${input.tagline}
Problem it claims to solve: ${input.problemSolved}
Full description: ${input.description}
Delivery link: ${input.deliveryUrl ?? "(none provided)"}

Flag anything where the description implies broad or unrelated access (e.g. "reads all your files" for a captioning tool), makes claims that can't be verified from a plain-language description, or reads as deliberately vague about what data it touches. A well-scoped tool with a clear, narrow description is low risk even if it touches sensitive data (e.g. "reads your voice recordings to fix pronunciation" is fine and specific).`;

  try {
    // Without this, a slow or hung Anthropic API left the whole upload/edit
    // request open with no response — the submit button stuck on its
    // pending label indefinitely instead of falling back to pending_review
    // within a few seconds, same as a missing API key already does.
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 500,
        tools: [REVIEW_TOOL],
        tool_choice: { type: "tool", name: "submit_review" },
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      // A null return here reads as "no automated opinion, wait for a
      // human" everywhere it's called — which is correct behavior, but
      // silently identical whether that's a missing key, a bad key, rate
      // limiting, or Anthropic being down. Every listing before this piled
      // up in the same pending_review queue with nothing in the logs to
      // say why; this at least makes that queue diagnosable instead of a
      // mystery each time someone asks "why is this stuck".
      console.error("[safety-review] Anthropic API call failed", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const toolUse = data.content?.find((block: { type: string }) => block.type === "tool_use");
    if (!toolUse) {
      console.error("[safety-review] no tool_use block in response", JSON.stringify(data).slice(0, 500));
      return null;
    }

    const verdict = toolUse.input as SafetyVerdict;
    // The model is asked for an integer 0-100, but nothing stops a bad or
    // out-of-range response from reaching here — clamp so a stray -5 or 140
    // never reaches the trust ring's stroke-offset math as-is.
    const score = Math.round(Number(verdict.score));
    return { ...verdict, score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0 };
  } catch (err) {
    console.error("[safety-review] request failed", err);
    return null;
  }
}
