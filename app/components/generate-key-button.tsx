"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// The plaintext key used to travel back to this page as a ?new_key=...
// redirect query param — that put a real secret in the browser's address
// bar, its history, and any request logging that records full URLs (Vercel
// included), for no reason beyond it being the only channel a plain HTML
// form POST has. A client-side fetch has a better channel: the response
// body, held only in this component's own state, never touching the URL or
// navigation history at all.
export function GenerateKeyButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/api-keys", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create a key — try again.");
        return;
      }
      setRevealedKey(data.plaintext);
      router.refresh(); // updates the "Your keys" list below with the new prefix
    } catch {
      setError("Could not reach the server — try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mb-10">
      {error && (
        <p className="mb-4 animate-shake rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}
      {revealedKey && (
        <div className="mb-6 rounded-2xl border border-accent/30 bg-accent-soft p-5">
          <h2 className="mb-2 font-display text-sm font-semibold text-accent">Your new key</h2>
          <p className="mb-3 text-xs text-ink-faint">
            Copy it now — this is the only time it&apos;s shown. Losing it means generating a new one.
          </p>
          <code className="block break-all rounded-lg border border-line bg-surface px-4 py-3 font-mono text-sm text-ink">
            {revealedKey}
          </code>
        </div>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="magnetic-btn rounded-full bg-accent px-6 py-3 text-sm font-medium text-[#04140f] transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Generating…" : "Generate new key"}
      </button>
    </div>
  );
}
