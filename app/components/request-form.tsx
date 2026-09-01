"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SubmitButton } from "@/app/components/submit-button";

type Match = { slug: string; name: string; tagline: string };

export function RequestForm() {
  const [description, setDescription] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (description.trim().length < 15) {
      setMatches([]);
      setChecked(false);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch("/api/requests/match", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ description }),
        });
        const data = await res.json();
        setMatches(data.matches ?? []);
        setChecked(true);
      } catch {
        setChecked(false);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [description]);

  return (
    <form action="/api/requests" method="POST" className="flex flex-col gap-4">
      <label className="group flex flex-col gap-1 text-sm">
        <span className="font-medium transition-colors duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] group-focus-within:text-accent">
          What do you need?
        </span>
        <textarea
          name="description"
          required
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the problem, not a product name — what are you stuck on, what would this need to actually do?"
          className="rounded-lg border border-line bg-surface px-4 py-2.5 text-ink outline-none transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] focus:border-accent focus:shadow-[0_0_0_3px_rgba(47,224,173,0.12)]"
        />
      </label>

      <div data-open={checked && matches.length > 0} className="grow-in rounded-lg border border-accent/30 bg-accent-soft">
        <div className="p-4">
          <p className="mb-2 text-sm font-medium text-accent">
            This might already exist — worth a look before you request a custom build:
          </p>
          <ul className="flex flex-col gap-1.5">
            {matches.map((m) => (
              <li key={m.slug}>
                <Link href={`/agents/${m.slug}`} className="text-sm text-accent underline">
                  {m.name}
                </Link>
                <span className="text-sm text-ink-soft"> — {m.tagline}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <SubmitButton
        pendingText="Submitting…"
        className="magnetic-btn mt-2 w-fit rounded-full bg-accent px-6 py-3 text-sm font-medium text-[#04140f] transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:opacity-90"
      >
        Submit request
      </SubmitButton>
    </form>
  );
}
