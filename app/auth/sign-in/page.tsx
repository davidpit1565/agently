"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

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

  // The clicked-link flow breaks whenever something between the inbox and
  // the browser fetches the link on its own — Gmail's own link-scanning,
  // an antivirus, a corporate proxy — because the token is single-use and
  // whichever request hits it first wins. Every "invalid or expired" report
  // during testing traced back to exactly that, never to a real double-click.
  // Typing the same 6-digit code by hand can't be pre-fetched, so it's the
  // reliable path — offered here rather than as the only option, since the
  // link still works fine for anyone whose email provider doesn't do this.
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    setVerifying(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-24">
      <h1 className="text-balance mb-2 font-display text-2xl font-semibold">Sign in</h1>
      <p className="mb-8 text-sm text-ink-faint">
        No password — we email you a one-time link and a 6-digit code.
      </p>

      {sent ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-lg bg-accent-soft p-4 text-sm text-accent">
            Check your inbox. Click the link, or type the 6-digit code from
            the same email below — the code works even if the link doesn't
            (some inboxes scan and use up links automatically before you
            click them).
          </p>
          <form onSubmit={handleVerifyCode} className="flex flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="rounded-lg border border-line bg-surface px-4 py-2.5 text-center text-lg tracking-[0.3em] text-ink outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={verifying}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#04140f] hover:opacity-90 disabled:opacity-60"
            >
              {verifying ? "Checking…" : "Verify code"}
            </button>
          </form>
        </div>
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
        </form>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </main>
  );
}
