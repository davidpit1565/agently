import Link from "next/link";

const ADMIN_LINKS = [
  { href: "/dashboard/admin/agents", label: "Listings" },
  { href: "/dashboard/admin/requests", label: "Requests" },
  { href: "/dashboard/admin/membership-events", label: "Membership" },
];

/** The three owner-only pages have no way to reach each other short of
 *  typing the URL — none of them are in the header's own "Admin" link,
 *  which only ever pointed at /dashboard/admin/agents. Shared here instead
 *  of duplicated per page so a fourth admin page only needs one line added. */
export function AdminNav({ active }: { active: "agents" | "requests" | "membership-events" }) {
  return (
    <nav className="mb-8 flex flex-wrap gap-2 text-sm">
      {ADMIN_LINKS.map((link) => {
        const isActive = link.href.endsWith(active);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full border px-3 py-1.5 transition-colors duration-200 ${
              isActive
                ? "border-accent/40 bg-accent-soft text-accent"
                : "border-line text-ink-faint hover:border-accent/30 hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
