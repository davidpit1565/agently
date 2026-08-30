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
      <span className="absolute -bottom-1 left-0 h-px w-0 bg-accent transition-all duration-300 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] group-hover:w-full" />
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
          className="magnetic-btn rounded-full border border-line px-3 py-1.5 transition-colors duration-200 hover:border-accent/50 hover:text-ink"
        >
          Sign out
        </button>
      </form>
    </div>
  ) : (
    <Link
      href="/auth/sign-in"
      className="magnetic-btn rounded-full border border-line px-3 py-1.5 transition-colors duration-200 hover:border-accent/50 hover:text-ink"
    >
      Sign in
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
      <div
        className={`mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-full border px-5 py-3 transition-all duration-300 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] ${
          scrolled
            ? "border-line bg-surface/80 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.5)] backdrop-blur-md"
            : "border-transparent bg-transparent"
        }`}
      >
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
            className="magnetic-btn relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line transition-colors duration-200 hover:border-accent/50"
          >
            <span className="sr-only">Menu</span>
            <span className="relative block h-3.5 w-4" aria-hidden>
              <span
                className={`absolute left-0 top-0 h-px w-4 bg-current transition-transform duration-300 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] ${
                  open ? "translate-y-[7px] rotate-45" : "translate-y-0 rotate-0"
                }`}
              />
              <span
                className={`absolute left-0 bottom-0 h-px w-4 bg-current transition-transform duration-300 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] ${
                  open ? "-translate-y-[7px] -rotate-45" : "translate-y-0 rotate-0"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <nav className="mx-auto mt-2 flex max-w-5xl origin-top animate-fade-up flex-col gap-1 rounded-3xl border border-line bg-surface/95 px-4 py-3 text-sm text-ink-soft shadow-[0_16px_40px_-16px_rgba(0,0,0,0.5)] backdrop-blur-md duration-200 sm:hidden">
          {NAV.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{ animationDelay: `${i * 60}ms` }}
              className="flex min-h-11 animate-menu-item-in items-center rounded-lg px-2 opacity-0 transition-colors hover:bg-surface hover:text-ink"
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
