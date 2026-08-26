"use client";

export function DelistButton({ agentId, agentName }: { agentId: string; agentName: string }) {
  return (
    <form
      action={`/api/agents/${agentId}/delist`}
      method="POST"
      onSubmit={(e) => {
        if (!confirm(`Remove "${agentName}" from the catalog? Buyers who already own it keep access.`)) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="text-ink-faint hover:text-red-400">
        Remove
      </button>
    </form>
  );
}
