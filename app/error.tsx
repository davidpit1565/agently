"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="font-mono text-sm text-ink-faint">500</span>
      <h1 className="text-balance font-display text-2xl font-semibold">
        Something <span className="text-accent">broke</span> on our end.
      </h1>
      <p className="text-sm text-ink-soft">
        Not you — this one's on us. Try again, or head back to the catalog
        if it keeps happening.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#04140f] hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/browse"
          className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink-soft hover:border-accent hover:text-ink"
        >
          Back to the catalog
        </Link>
      </div>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-ink-faint">ref: {error.digest}</p>
      )}
    </main>
  );
}
