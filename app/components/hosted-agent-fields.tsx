"use client";

import { useState } from "react";

type Props = {
  defaultAgentKind?: "file" | "prompt" | "workflow";
  defaultHostedSystemPrompt?: string;
  defaultHostedWebhookUrl?: string;
  defaultCreditsPerCall?: number | null;
};

// Lets a creator choose how this listing is actually delivered — the
// default ('file') is today's existing behavior, completely unchanged.
// Choosing 'prompt' or 'workflow' means the buyer never receives
// delivery_url at all — they get an API key + credit wallet instead (see
// plan/agently-hosted-api-concept.html and app/agents/[slug]/page.tsx's
// "Use via API" block). Client-side only for which fields are *shown* —
// the real validation is server-side (lib/hosted-agents.ts's
// validateHostedAgentFields), same as every other field in this form.
export function HostedAgentFields({
  defaultAgentKind = "file",
  defaultHostedSystemPrompt = "",
  defaultHostedWebhookUrl = "",
  defaultCreditsPerCall,
}: Props) {
  const [kind, setKind] = useState(defaultAgentKind);

  const fieldClass =
    "rounded-lg border border-line bg-surface px-4 py-2.5 text-ink outline-none transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] focus:border-accent focus:shadow-[0_0_0_3px_rgba(47,224,173,0.12)]";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface/50 p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">How is this agent delivered?</span>
        <select
          name="agent_kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className={fieldClass}
        >
          <option value="file">File delivery — a link or attached file, like today</option>
          <option value="prompt">Hosted prompt — runs on Agently, buyer gets an API key</option>
          <option value="workflow">Hosted workflow — calls your own webhook, buyer gets an API key</option>
        </select>
        <span className="text-xs text-ink-faint">
          A hosted agent&apos;s actual logic is never handed to the buyer — see{" "}
          <code className="text-ink-soft">/dashboard/api-keys</code> for how they call it.
        </span>
      </label>

      {kind !== "file" && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Credits per call</span>
          <input
            type="number"
            name="credits_per_call"
            min="1"
            step="1"
            required
            defaultValue={defaultCreditsPerCall ?? undefined}
            className={fieldClass}
          />
          <span className="text-xs text-ink-faint">
            Deducted from the buyer&apos;s wallet on every real call to /api/agents/[slug]/invoke.
          </span>
        </label>
      )}

      {kind === "prompt" && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Hidden system prompt</span>
          <textarea
            name="hosted_system_prompt"
            rows={6}
            required
            defaultValue={defaultHostedSystemPrompt}
            className={fieldClass}
          />
          <span className="text-xs text-ink-faint">
            Never shown to the buyer, in any form — this is the whole thing being sold.
          </span>
        </label>
      )}

      {kind === "workflow" && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Your webhook URL (n8n or similar)</span>
          <input
            type="url"
            name="hosted_webhook_url"
            required
            defaultValue={defaultHostedWebhookUrl}
            className={fieldClass}
          />
          <span className="text-xs text-ink-faint">
            Called server-to-server on every real invoke — never shown to the buyer.
          </span>
        </label>
      )}
    </div>
  );
}
