/**
 * The safety-review agent from the market research report (ch. 5) — first
 * real pass. Reviews a submitted listing against what it claims to do, what
 * it asks permission for, and whether the description matches. A "low"
 * verdict auto-approves; anything else stays pending_review for a human,
 * same as today. Needs ANTHROPIC_API_KEY — without it, callers should treat
 * a null return as "skip automated review, leave it for a human" (the
 * existing behavior), not as an error.
 */

export type SafetyVerdict = {
  risk: "low" | "medium" | "high";
  flags: string[];
  summary: string;
};

const REVIEW_TOOL = {
  name: "submit_review",
  description: "Submit the safety review verdict for this agent listing.",
  input_schema: {
    type: "object",
    properties: {
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
    required: ["risk", "flags", "summary"],
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
    });

    if (!res.ok) return null;

    const data = await res.json();
    const toolUse = data.content?.find((block: { type: string }) => block.type === "tool_use");
    if (!toolUse) return null;

    return toolUse.input as SafetyVerdict;
  } catch {
    return null;
  }
}
