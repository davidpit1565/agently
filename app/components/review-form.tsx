"use client";

import { useState } from "react";

export function ReviewForm({ agentId }: { agentId: string }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);

  return (
    <form action="/api/reviews" method="POST" className="flex flex-col gap-3">
      <input type="hidden" name="agentId" value={agentId} />
      <input type="hidden" name="rating" value={rating} />

      <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHovered(n)}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            className="p-0.5"
          >
            <svg
              viewBox="0 0 20 20"
              width="22"
              height="22"
              fill={n <= (hovered || rating) ? "#2fe0ad" : "none"}
              stroke={n <= (hovered || rating) ? "#2fe0ad" : "currentColor"}
              strokeWidth="1.3"
              className="text-ink-faint"
            >
              <path d="M10 1.6l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L1.4 7.9l6-.8z" />
            </svg>
          </button>
        ))}
      </div>

      <textarea
        name="comment"
        rows={2}
        placeholder="Optional — what happened when you used it?"
        className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-accent"
      />

      <button
        type="submit"
        disabled={rating === 0}
        className="w-fit rounded-full border border-line px-4 py-2 text-sm font-medium text-ink disabled:text-ink-faint disabled:opacity-50 enabled:hover:border-accent/50"
      >
        Submit review
      </button>
    </form>
  );
}
