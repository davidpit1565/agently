"use client";

import { useState } from "react";

export function RemoveFileButton({
  agentId,
  fileId,
  fileName,
}: {
  agentId: string;
  fileId: string;
  fileName: string;
}) {
  const [pending, setPending] = useState(false);

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
          return;
        }
        setPending(true);
      }}
    >
      <button type="submit" disabled={pending} className="text-xs text-ink-faint hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60">
        {pending ? "Removing…" : "Remove"}
      </button>
    </form>
  );
}
