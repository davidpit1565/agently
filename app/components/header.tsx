"use client";

import { useState } from "react";
import Link from "next/link";

const NAV = [
  { href: "/browse", label: "Browse" },
  { href: "/pricing", label: "Membership" },
  { href: "/dashboard/upload", label: "Upload an agent" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-ink/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="shrink-0 text-sm font-semibold tracking-tight">
          Agently
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-ink/70 sm:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-ink">
              {item.label}
            </Link>
          ))}
          <Link
            href="/auth/sign-in"
            className="rounded-full border border-ink/15 px-3 py-1.5 hover:border-ink/40 hover:text-ink"
          >
            Sign in
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:hidden">
          <Link
            href="/auth/sign-in"
            className="flex h-11 items-center rounded-full border border-ink/15 px-4 text-sm hover:border-ink/40"
          >
            Sign in
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink/15"
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
        <nav className="flex flex-col gap-1 border-t border-ink/10 px-6 py-3 text-sm text-ink/70 sm:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center rounded-lg px-2 hover:bg-ink/5 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
