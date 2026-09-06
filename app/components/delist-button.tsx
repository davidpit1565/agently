"use client";

import { useState } from "react";

export function DelistButton({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action={`/api/agents/${agentId}/delist`}
      method="POST"
      onSubmit={(e) => {
        if (!confirm(`Remove "${agentName}" from the catalog? Buyers who already own it keep access.`)) {
          e.preventDefault();
          return;
        }
        setPending(true);
      }}
    >
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-faint transition-colors duration-150 hover:border-red-400/50 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
    </form>
  );
}
