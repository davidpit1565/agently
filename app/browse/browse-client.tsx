"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CATEGORIES_FALLBACK } from "@/data/categories";
import { AgentCard } from "@/app/components/agent-card";
import { Reveal } from "@/app/components/reveal";
import type { Agent } from "@/lib/types";

export function BrowseClient({ agents }: { agents: Agent[] }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Agent ids in relevance order from /api/search, or null when semantic
  // ranking isn't available for this query (no VOYAGE_API_KEY, the call
  // failed, or nothing embedded cleared the similarity bar) — null means
  // "fall back to substring matching," never "no results."
  const [semanticIds, setSemanticIds] = useState<string[] | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSemanticIds(null);
      return;
    }

    const controller = new AbortController();
    // Debounced, not on every keystroke — this is a network call per query.
    const timer = setTimeout(() => {
      fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data) => setSemanticIds(data.ranked ?? null))
        .catch(() => setSemanticIds(null));
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byCategory = agents.filter((agent) => !activeCategory || agent.category_slug === activeCategory);

    if (!q) return byCategory;

    if (semanticIds) {
      const rank = new Map(semanticIds.map((id, i) => [id, i]));
      return byCategory
        .filter((agent) => rank.has(agent.id))
        .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
    }

    // Fallback: no semantic ranking available for this query.
    return byCategory.filter((agent) => {
      const haystack = `${agent.name} ${agent.tagline} ${agent.problem_solved}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [agents, query, activeCategory, semanticIds]);

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
            className="w-full rounded-xl border border-line bg-surface py-3 pl-11 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent/50"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={`rounded-full border px-3 py-1 text-xs transition-all duration-200 ${
              activeCategory === null
                ? "border-accent/50 bg-accent-soft text-accent"
                : "border-line text-ink-faint hover:-translate-y-0.5 hover:border-accent/30"
            }`}
          >
            All
          </button>
          {usedCategories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setActiveCategory(activeCategory === c.slug ? null : c.slug)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all duration-200 ${
                activeCategory === c.slug
                  ? "border-accent/50 bg-accent-soft text-accent"
                  : "border-line text-ink-faint hover:-translate-y-0.5 hover:border-accent/30"
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
        <div className="flex animate-fade-up flex-col items-center gap-2 rounded-xl border border-dashed border-line py-20 text-center">
          <span className="h-2 w-2 rounded-full bg-ink-faint" aria-hidden />
          <p className="font-display text-lg font-semibold">Nothing matches that yet</p>
          <p className="max-w-sm text-sm text-ink-soft">
            The catalog is still small. Try a broader search, or{" "}
            <Link href="/dashboard/upload" className="text-accent underline">
              list the agent
            </Link>{" "}
            that would solve this.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent, i) => (
            <Reveal key={agent.id} delay={Math.min(i, 8) * 60}>
              <AgentCard agent={agent} />
            </Reveal>
          ))}
        </div>
      )}
    </>
  );
}
