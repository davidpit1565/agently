import Link from "next/link";
import { Reveal } from "@/app/components/reveal";

/** Same three real accounts as the Actually Works site (videos-ai/studio/app/site-social.tsx)
 *  — one source of truth for the icons, kept in sync by hand until these two sites share a
 *  package. Update both places together if an account changes (a rename is planned but not
 *  live yet — see CLAUDE.md). */
const SOCIAL_LINKS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/actually_works.ai/",
    path: "M12 2.2c2.7 0 3 0 4.1.06 1.1.05 1.8.22 2.4.46.65.25 1.2.6 1.7 1.1.5.5.85 1.05 1.1 1.7.24.6.4 1.3.46 2.4.05 1.1.06 1.4.06 4.1s0 3-.06 4.1c-.05 1.1-.22 1.8-.46 2.4-.25.65-.6 1.2-1.1 1.7-.5.5-1.05.85-1.7 1.1-.6.24-1.3.4-2.4.46-1.1.05-1.4.06-4.1.06s-3 0-4.1-.06c-1.1-.05-1.8-.22-2.4-.46a4.6 4.6 0 0 1-1.7-1.1 4.6 4.6 0 0 1-1.1-1.7c-.24-.6-.4-1.3-.46-2.4C2.2 15 2.2 14.7 2.2 12s0-3 .06-4.1c.05-1.1.22-1.8.46-2.4.25-.65.6-1.2 1.1-1.7.5-.5 1.05-.85 1.7-1.1.6-.24 1.3-.4 2.4-.46C9 2.2 9.3 2.2 12 2.2zm0 1.8c-2.66 0-2.97 0-4.02.06-.9.04-1.4.19-1.72.31-.43.17-.74.37-1.07.7-.33.33-.53.64-.7 1.07-.12.32-.27.82-.31 1.72C4.13 9.03 4.12 9.34 4.12 12s0 2.97.06 4.02c.04.9.19 1.4.31 1.72.17.43.37.74.7 1.07.33.33.64.53 1.07.7.32.12.82.27 1.72.31 1.05.06 1.36.06 4.02.06s2.97 0 4.02-.06c.9-.04 1.4-.19 1.72-.31.43-.17.74-.37 1.07-.7.33-.33.53-.64.7-1.07.12-.32.27-.82.31-1.72.06-1.05.06-1.36.06-4.02s0-2.97-.06-4.02c-.04-.9-.19-1.4-.31-1.72a2.8 2.8 0 0 0-.7-1.07 2.8 2.8 0 0 0-1.07-.7c-.32-.12-.82-.27-1.72-.31C14.97 4 14.66 4 12 4zm0 3.05a4.95 4.95 0 1 1 0 9.9 4.95 4.95 0 0 1 0-9.9zm0 1.8a3.15 3.15 0 1 0 0 6.3 3.15 3.15 0 0 0 0-6.3zm5.15-1.98a1.16 1.16 0 1 1-2.32 0 1.16 1.16 0 0 1 2.32 0z",
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/channel/UCY39bV1ZDKTI05ul5wg11Og",
    path: "M22.5 7.2a2.9 2.9 0 0 0-2-2C18.7 4.7 12 4.7 12 4.7s-6.7 0-8.5.5a2.9 2.9 0 0 0-2 2A30 30 0 0 0 1 12a30 30 0 0 0 .5 4.8 2.9 2.9 0 0 0 2 2c1.8.5 8.5.5 8.5.5s6.7 0 8.5-.5a2.9 2.9 0 0 0 2-2A30 30 0 0 0 23 12a30 30 0 0 0-.5-4.8zM9.7 15.3V8.7l5.8 3.3-5.8 3.3z",
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/share/1FgKqqSQcw/?mibextid=wwXIfr",
    path: "M13.5 21.8v-8.2h2.75l.41-3.2h-3.16V8.35c0-.93.26-1.56 1.59-1.56h1.7V3.94c-.3-.04-1.3-.13-2.48-.13-2.45 0-4.13 1.5-4.13 4.24v2.36H7.4v3.2h2.78v8.2h3.32z",
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line px-6 py-8 text-center text-xs text-ink-faint">
      <Reveal className="mb-4 flex items-center justify-center gap-4">
        {SOCIAL_LINKS.map((l) => (
          <a
            key={l.name}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={l.name}
            className="text-ink-faint transition-all duration-200 hover:-translate-y-0.5 hover:text-accent"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d={l.path} />
            </svg>
          </a>
        ))}
      </Reveal>
      <p>
        Agently is part of{" "}
        <a
          href="https://actually-works-studio.vercel.app"
          className="underline hover:text-accent"
        >
          Actually Works
        </a>{" "}
        — built by a creator who uses this catalog on their own channel first.{" "}
        <Link href="/about" className="underline hover:text-accent">
          About
        </Link>
        {" · "}
        <Link href="/terms" className="underline hover:text-accent">
          Terms (draft)
        </Link>
        .
      </p>
    </footer>
  );
}
