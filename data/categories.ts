import type { Category } from "@/lib/types";

// Mirrors the rows seeded into `categories` by supabase/schema.sql, plus a
// muted per-category hue — kept low-saturation and separate from the brand
// accent (#2fe0ad) so categories read as information, not competing brands.
export const CATEGORIES_FALLBACK: Category[] = [
  { slug: "content-video", name: "Content & Video", description: "Editing, captions, pacing, rendering", color: "#b18cf5" },
  { slug: "voice-audio", name: "Voice & Audio", description: "TTS, cleanup, mastering, dubbing", color: "#f5b95c" },
  { slug: "research-writing", name: "Research & Writing", description: "Drafting, summarizing, fact-checking", color: "#6cc5f0" },
  { slug: "automation", name: "Automation", description: "Workflows, scraping, scheduled tasks", color: "#f28aa8" },
  { slug: "customer-support", name: "Customer Support", description: "Chat, tickets, FAQ handling", color: "#8ea3f0" },
  { slug: "coding-dev", name: "Coding & Development", description: "Code review, security, testing, developer tooling", color: "#5cc98a" },
  { slug: "data-analytics", name: "Data & Analytics", description: "Dashboards, reporting, data pipelines", color: "#c9a15c" },
  { slug: "design-ux", name: "Design & UX", description: "Visual design, animation, UI polish", color: "#e08ac9" },
  { slug: "trading-finance", name: "Trading & Finance", description: "Money math, trading bots, financial correctness", color: "#7ad1c9" },
  { slug: "sales-marketing", name: "Sales & Marketing", description: "Ads, copywriting, growth", color: "#f0836c" },
  { slug: "other", name: "Other", description: "Everything else", color: "#8f9a93" },
];
