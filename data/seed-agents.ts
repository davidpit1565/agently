import type { Agent } from "@/lib/types";

/**
 * The first entries in the catalog — per report ch. 12, the initial supply is
 * David's own tools, not placeholder demo content. These five are already
 * real, working pieces described in the videos-ai project (CLAUDE.md):
 * voice_doctor.py, retime.py, the explain-steps skill, safe_check.js, and
 * karaoke.py. Swap `delivery_url` for the real repo/package link when each
 * one is actually packaged for a buyer to take.
 *
 * This file is a fallback fixture: pages read from Supabase first and fall
 * back to this list so the site has something real to show before the
 * database is wired up (see lib/catalog.ts).
 */
export const SEED_AGENTS: Agent[] = [
  {
    id: "seed-voice-doctor",
    creator_id: "seed-creator",
    slug: "voice-doctor",
    name: "Voice Doctor",
    tagline: "Hears what's wrong with a voice line and fixes it.",
    problem_solved:
      "My AI narration has a bad take somewhere — muddy sibilance, a rushed word, an ending that trails off — and I can't tell exactly where or how to fix it.",
    description:
      "Runs a diagnostic pass over a rendered voice line, flags the specific defect (pacing, rate, sibilance, word endings), and can repair it directly with --repair, iterating until a pass finds nothing. Built for the exaggeration/cfg voice-cloning workflow, not a generic audio cleanup tool.",
    category_slug: "voice-audio",
    pricing_model: "subscription",
    price_cents: 1900,
    currency: "eur",
    delivery_url: null,
    status: "approved",
    review_notes: "Self-reviewed at MVP stage — creator is the platform owner.",
    trust_score: 72,
    version: 1,
    embedding: null,
    view_count: 0,
    created_at: new Date("2026-08-01").toISOString(),
    updated_at: new Date("2026-08-01").toISOString(),
  },
  {
    id: "seed-retime",
    creator_id: "seed-creator",
    slug: "retime",
    name: "Retime",
    tagline: "Moves your build's timing to match the voice, not the other way around.",
    problem_solved:
      "I built the picture first and now the narration doesn't fit — squeezing the audio to match is making it sound rushed and unnatural.",
    description:
      "Takes a build and its voice cue file and re-times every element in the build to match the actual pace of the recorded narration. The alternative — squeezing audio to fit a fixed timeline — is what produced overlapping lines in early episodes here. This fixes it at the source.",
    category_slug: "content-video",
    pricing_model: "one_time",
    price_cents: 4900,
    currency: "eur",
    delivery_url: null,
    status: "approved",
    review_notes: "Self-reviewed at MVP stage — creator is the platform owner.",
    trust_score: 68,
    version: 1,
    embedding: null,
    view_count: 0,
    created_at: new Date("2026-08-05").toISOString(),
    updated_at: new Date("2026-08-05").toISOString(),
  },
  {
    id: "seed-explain-steps",
    creator_id: "seed-creator",
    slug: "explain-steps",
    name: "Explain Steps",
    tagline: "Turns a technical how-to into numbered clicks a non-technical person can follow.",
    problem_solved:
      "I need to explain a piece of software to someone non-technical and every explanation I write assumes something they don't know.",
    description:
      "Produces step-by-step instructions with numbered clicks, interface labels named exactly as they appear on screen, the boring path instead of the clever shortcut, and optional steps clearly marked as optional. When a reader says they didn't understand, it replaces the assumption instead of just repeating the same step louder.",
    category_slug: "automation",
    pricing_model: "free",
    price_cents: null,
    currency: "eur",
    delivery_url: null,
    status: "approved",
    review_notes: "Self-reviewed at MVP stage — creator is the platform owner.",
    trust_score: 65,
    version: 1,
    embedding: null,
    view_count: 0,
    created_at: new Date("2026-08-10").toISOString(),
    updated_at: new Date("2026-08-10").toISOString(),
  },
  {
    id: "seed-safe-check",
    creator_id: "seed-creator",
    slug: "safe-check",
    name: "Safe Check",
    tagline: "Catches subtitles hidden behind the Instagram UI before you render.",
    problem_solved:
      "My reel's captions or on-screen text look fine in the editor but get covered by the platform's own UI once it's posted.",
    description:
      "Walks the real DOM of a build at sample times and flags any visible text box outside the platform's safe area (top 14%, bottom 35%, 6% each side on 9:16), plus any two text boxes landing on top of each other. Waits for reveal transitions to finish before checking, so it doesn't false-flag mid-animation frames.",
    category_slug: "content-video",
    pricing_model: "subscription",
    price_cents: 1200,
    currency: "eur",
    delivery_url: null,
    status: "approved",
    review_notes: "Self-reviewed at MVP stage — creator is the platform owner.",
    trust_score: 70,
    version: 1,
    embedding: null,
    view_count: 0,
    created_at: new Date("2026-08-14").toISOString(),
    updated_at: new Date("2026-08-14").toISOString(),
  },
  {
    id: "seed-karaoke",
    creator_id: "seed-creator",
    slug: "karaoke-captions",
    name: "Karaoke Captions",
    tagline: "Word-by-word captions that actually match what was said.",
    problem_solved:
      "Auto-generated captions either dump a full sentence at once or split named things (like a product name) across two chunks.",
    description:
      "Aligns Whisper's word-level timestamps onto the original script — so a multi-word name stays one unit — and emits 2-3 word chunks with the spoken word highlighted. Built after measuring that most short-form video mistakes come from full-sentence captions sitting at the bottom of frame.",
    category_slug: "content-video",
    pricing_model: "one_time",
    price_cents: 2900,
    currency: "eur",
    delivery_url: null,
    status: "approved",
    review_notes: "Self-reviewed at MVP stage — creator is the platform owner.",
    trust_score: 66,
    version: 1,
    embedding: null,
    view_count: 0,
    created_at: new Date("2026-08-18").toISOString(),
    updated_at: new Date("2026-08-18").toISOString(),
  },
];
