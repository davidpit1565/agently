"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CATEGORIES_FALLBACK } from "@/data/categories";
import { AgentCard } from "@/app/components/agent-card";
import type { Agent } from "@/lib/types";

export function BrowseClient({ agents }: { agents: Agent[] }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((agent) => {
      if (activeCategory && agent.category_slug !== activeCategory) return false;
      if (!q) return true;
      const haystack = `${agent.name} ${agent.tagline} ${agent.problem_solved}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [agents, query, activeCategory]);

  const usedCategories = useMemo(
    () => CATEGORIES_FALLBACK.filter((c) => agents.some((a) => a.category_slug === c.slug)),
    [agents]
  );

  return (
    <>
      <div className="mb-6 flex flex-col gap-3">
        <div className="relative">
          <svg
            viewBox="0 0 20 20"
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="M17 17l-4-4" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What are you stuck on? e.g. “my captions get cut off on Instagram”"
            className="w-full rounded-xl border border-line bg-surface py-3 pl-11 pr-4 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-accent/50"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              activeCategory === null
                ? "border-accent/50 bg-accent-soft text-accent"
                : "border-line text-ink-faint hover:border-accent/30"
            }`}
          >
            All
          </button>
          {usedCategories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setActiveCategory(activeCategory === c.slug ? null : c.slug)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                activeCategory === c.slug
                  ? "border-accent/50 bg-accent-soft text-accent"
                  : "border-line text-ink-faint hover:border-accent/30"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} aria-hidden />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-6 font-mono text-sm text-ink-faint">
        {filtered.length} agent{filtered.length === 1 ? "" : "s"}
        {query || activeCategory ? " match" : " · sorted newest first"}
      </p>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line py-20 text-center">
          <span className="h-2 w-2 rounded-full bg-ink-faint" aria-hidden />
          <p className="font-display text-lg font-semibold">Nothing matches that yet</p>
          <p className="max-w-sm text-sm text-ink-soft">
            The catalog is still small — the concierge that matches a problem to
            an agent by meaning (not exact words) is planned but not built.
            Try a broader search, or{" "}
            <Link href="/dashboard/upload" className="text-accent underline">
              list the agent
            </Link>{" "}
            that would solve this.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </>
  );
}
