"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NotificationBell } from "@/app/components/notification-bell";

const NAV = [
  { href: "/browse", label: "Browse" },
  { href: "/pricing", label: "Membership" },
  { href: "/dashboard/upload", label: "Upload an agent" },
];

/** An underline that grows in from the left on hover instead of just appearing —
 *  a small motion cue that makes the nav feel responsive to the cursor, not static text. */
function NavLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="group relative transition-colors duration-200 hover:text-ink">
      {label}
      <span className="absolute -bottom-1 left-0 h-px w-0 bg-accent transition-all duration-300 ease-out group-hover:w-full" />
    </Link>
  );
}

export function Header({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const account = signedIn ? (
    <div className="flex items-center gap-3">
      <Link href="/dashboard/agents" className="hover:text-ink">
        Your agents
      </Link>
      <Link href="/dashboard/settings" className="hover:text-ink">
        Settings
      </Link>
      <form action="/auth/sign-out" method="POST">
        <button
          type="submit"
          className="rounded-full border border-line px-3 py-1.5 hover:border-accent/50 hover:text-ink"
        >
          Sign out
        </button>
      </form>
    </div>
  ) : (
    <Link
      href="/auth/sign-in"
      className="rounded-full border border-line px-3 py-1.5 hover:border-accent/50 hover:text-ink"
    >
      Sign in
    </Link>
  );

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-colors duration-300 ${
        scrolled ? "border-line bg-ground/80 backdrop-blur-md" : "border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-display text-sm font-semibold tracking-tight">
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-accent" aria-hidden />
          Agently
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-ink-soft sm:flex">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
          <NotificationBell />
          {account}
        </nav>

        <div className="flex items-center gap-2 sm:hidden">
          <NotificationBell />
          {signedIn ? (
            <form action="/auth/sign-out" method="POST">
              <button
                type="submit"
                className="flex h-11 items-center rounded-full border border-line px-4 text-sm hover:border-accent/50"
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/auth/sign-in"
              className="flex h-11 items-center rounded-full border border-line px-4 text-sm hover:border-accent/50"
            >
              Sign in
            </Link>
          )}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line"
          >
            <span className="sr-only">Menu</span>
            {open ? (
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {open && (
        <nav className="flex origin-top animate-fade-up flex-col gap-1 border-t border-line px-6 py-3 text-sm text-ink-soft duration-200 sm:hidden">
          {NAV.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{ animationDelay: `${i * 40}ms` }}
              className="flex min-h-11 animate-fade-up items-center rounded-lg px-2 opacity-0 transition-colors hover:bg-surface hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
          {signedIn && (
            <>
              <Link
                href="/dashboard/agents"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center rounded-lg px-2 hover:bg-surface hover:text-ink"
              >
                Your agents
              </Link>
              <Link
                href="/dashboard/settings"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center rounded-lg px-2 hover:bg-surface hover:text-ink"
              >
                Settings
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
