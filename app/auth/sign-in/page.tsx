"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-24">
      <h1 className="mb-2 font-display text-2xl font-semibold">Sign in</h1>
      <p className="mb-8 text-sm text-ink-faint">
        No password — we email you a one-time link.
      </p>

      {sent ? (
        <p className="rounded-lg bg-accent-soft p-4 text-sm text-accent">
          Check your inbox for a sign-in link.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#04140f] hover:opacity-90"
          >
            Send link
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      )}
    </main>
  );
}
