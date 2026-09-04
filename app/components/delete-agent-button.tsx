"use client";

export function DeleteAgentButton({ agentId, agentName }: { agentId: string; agentName: string }) {
  return (
    <form
      action={`/api/agents/${agentId}/delete`}
      method="POST"
      onSubmit={(e) => {
        if (
          !confirm(
            `Permanently delete "${agentName}"? This can't be undone — unlike Remove, this erases the listing itself, not just its catalog visibility.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-full border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors duration-150 hover:border-red-400 hover:bg-red-500/10"
      >
        Delete
      </button>
    </form>
  );
}
