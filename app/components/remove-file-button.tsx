"use client";

export function RemoveFileButton({
  agentId,
  fileId,
  fileName,
}: {
  agentId: string;
  fileId: string;
  fileName: string;
}) {
  return (
    <form
      action={`/api/agents/${agentId}/files/${fileId}`}
      method="POST"
      onSubmit={(e) => {
        if (
          !confirm(
            `Remove "${fileName}"? This deletes it permanently — buyers who already own this listing will lose the ability to download it.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="text-xs text-ink-faint hover:text-red-400">
        Remove
      </button>
    </form>
  );
}
