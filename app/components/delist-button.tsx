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
      <button
        type="submit"
        className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-faint transition-colors duration-150 hover:border-red-400/50 hover:text-red-400"
      >
        Remove
      </button>
    </form>
  );
}
