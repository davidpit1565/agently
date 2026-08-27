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
    const { error } = await supabase.auth.signInWithOtp({
      email,
      // Without this, Supabase falls back to whatever "Site URL" is set in
      // its own dashboard (localhost by default on a new project) — the
      // email link would point there instead of here, regardless of what
      // domain someone actually opened this page from.
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="relative mx-auto max-w-sm overflow-hidden px-6 py-24">
      <div className="hero-glow">
        <div className="hero-glow-a" />
      </div>
      <div className="relative animate-fade-up">
        <h1 className="text-balance mb-2 font-display text-2xl font-semibold">Sign in</h1>
        <p className="mb-8 text-sm text-ink-faint">
          No password — we email you a one-time link.
        </p>

        {sent ? (
          <p className="flex animate-pop-in items-center gap-2 rounded-lg bg-accent-soft p-4 text-sm text-accent">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 10.5l3.5 3.5L16 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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
              className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent"
            />
            <button
              type="submit"
              className="shine-sweep rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#04140f] transition-transform duration-200 hover:-translate-y-0.5 hover:opacity-90"
            >
              Send link
            </button>
            {error && <p className="animate-shake text-sm text-red-400">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
