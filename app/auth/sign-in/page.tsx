"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function SignInForm() {
  const router = useRouter();
  // Where to land after signing in — app/invite/[token]/page.tsx sends
  // someone here with ?next=/invite/<token> when they click a team invite
  // without an account yet, so accepting it doesn't need a second click
  // after signing in. Falls back to the app/auth/callback route's own
  // default (/browse) for every ordinary sign-in.
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const callbackUrl = new URL(`${window.location.origin}/auth/callback`);
    if (next) callbackUrl.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      // Without this, Supabase falls back to whatever "Site URL" is set in
      // its own dashboard (localhost by default on a new project) — the
      // email link would point there instead of here, regardless of what
      // domain someone actually opened this page from.
      options: { emailRedirectTo: callbackUrl.toString() },
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
    router.push(next || "/");
    router.refresh();
  }

  return (
    <main className="relative mx-auto max-w-sm overflow-hidden px-6 py-24">
      <div className="hero-glow">
        <div className="hero-glow-a" />
      </div>
      <div className="bezel-shell relative animate-reveal-up">
      <div className="bezel-core border border-line bg-surface p-6">
        <h1 className="text-balance mb-2 font-display text-2xl font-semibold">Sign in</h1>
        <p className="mb-8 text-sm text-ink-faint">
          No password — we email you a one-time link and a 6-digit code.
        </p>

        {sent ? (
          <div className="flex animate-pop-in flex-col gap-4">
            <p className="flex items-start gap-2 rounded-lg bg-accent-soft p-4 text-sm text-accent">
              <svg
                viewBox="0 0 20 20"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="mt-0.5 shrink-0"
              >
                <path d="M4 10.5l3.5 3.5L16 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
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
                className="rounded-lg border border-line bg-surface px-4 py-2.5 text-center text-lg tracking-[0.3em] text-ink outline-none transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] focus:border-accent focus:shadow-[0_0_0_3px_rgba(47,224,173,0.12)]"
              />
              <button
                type="submit"
                disabled={verifying}
                className="shine-sweep magnetic-btn rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#04140f] transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:opacity-90 disabled:opacity-60"
              >
                {verifying ? "Checking…" : "Verify code"}
              </button>
              {error && <p className="animate-shake text-sm text-red-400">{error}</p>}
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
              className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] focus:border-accent focus:shadow-[0_0_0_3px_rgba(47,224,173,0.12)]"
            />
            <button
              type="submit"
              className="shine-sweep magnetic-btn rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#04140f] transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:opacity-90"
            >
              Send link
            </button>
            {error && <p className="animate-shake text-sm text-red-400">{error}</p>}
          </form>
        )}
      </div>
      </div>
    </main>
  );
}

// useSearchParams() (for the ?next= redirect target above) opts this whole
// page out of static rendering unless it's wrapped in Suspense — without
// this, `next build` fails outright rather than just losing prerendering.
export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
