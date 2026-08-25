import type { Category } from "@/lib/types";

// Mirrors the rows seeded into `categories` by supabase/schema.sql.
export const CATEGORIES_FALLBACK: Category[] = [
  { slug: "content-video", name: "Content & Video", description: "Editing, captions, pacing, rendering" },
  { slug: "voice-audio", name: "Voice & Audio", description: "TTS, cleanup, mastering, dubbing" },
  { slug: "research-writing", name: "Research & Writing", description: "Drafting, summarizing, fact-checking" },
  { slug: "automation", name: "Automation", description: "Workflows, scraping, scheduled tasks" },
  { slug: "customer-support", name: "Customer Support", description: "Chat, tickets, FAQ handling" },
  { slug: "other", name: "Other", description: "Everything else" },
];
