"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Notification = {
  id: string;
  agent_slug: string | null;
  message: string;
  read: boolean;
  created_at: string;
};

// Renders nothing when signed out or when Supabase isn't configured — the
// GET below returns an empty list either way, so there's nothing to show.
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || notifications.length === 0) return null;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      fetch("/api/notifications/read", { method: "POST" });
      setUnreadCount(0);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-line hover:border-accent/50"
      >
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 8a6 6 0 1 1 12 0c0 4 1.5 5 1.5 5h-15S4 12 4 8Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 16a2 2 0 0 0 4 0" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[52px] z-10 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface-raised p-2 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)]"
        >
          {notifications.map((n) => (
            <Link
              key={n.id}
              href={n.agent_slug ? `/agents/${n.agent_slug}` : "#"}
              className="block rounded-lg px-3 py-2.5 text-sm text-ink-soft hover:bg-surface"
            >
              {n.message}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
