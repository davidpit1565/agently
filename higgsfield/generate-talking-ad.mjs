#!/usr/bin/env node
// Generate a talking-head ad clip via Higgsfield's Speak v2 API.
//
// Credentials come from HF_API_KEY / HF_SECRET, loaded from
// higgsfield/.env (gitignored — see .env.example). Get a key pair at
// https://cloud.higgsfield.ai/api-keys.
//
// Endpoint, auth header shape, and the submit-response shape ({"id",
// "type", "jobs"}) come from Higgsfield's own open-source MCP integration
// (github.com/QalaLabs/claude-higgsfield-mcp) — the closest thing to a
// public reference implementation available, since the official docs
// site isn't scrapable. NOT confirmed from any source: the exact field
// path to the finished video URL inside a completed job-set response.
// This script tries a few plausible paths and always saves the full raw
// response either way — if none of them hit, open the saved JSON and
// send it back so the extraction logic gets fixed against a real
// response instead of guessed at twice.
//
// This is unrelated to the rest of this repo (an AI-agent marketplace) —
// self-contained here on request, not wired into the app.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = (m[2] ?? "").trim();
  }
}
loadEnv(path.join(__dirname, ".env"));

const BASE_URL = "https://platform.higgsfield.ai";

function headers() {
  const key = process.env.HF_API_KEY;
  const secret = process.env.HF_SECRET;
  if (!key || !secret) {
    console.error(
      "Missing HF_API_KEY / HF_SECRET.\n" +
        "Copy higgsfield/.env.example to higgsfield/.env and fill them in."
    );
    process.exit(1);
  }
  return {
    Authorization: `Key ${key}:${secret}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function submitTalkingHead({ imageUrl, audioUrl, prompt, quality = "high", duration = 5, seed = 42 }) {
  const body = { params: { image_url: imageUrl, audio_url: audioUrl, prompt, quality, duration, seed } };
  const r = await fetch(`${BASE_URL}/v1/speak/higgsfield`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Submit failed: ${r.status} ${await r.text()}`);
  return r.json();
}

async function pollJobSet(jobSetId, { interval = 5000, timeout = 600000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const r = await fetch(`${BASE_URL}/v1/job-sets/${jobSetId}`, { headers: headers() });
    if (!r.ok) throw new Error(`Poll failed: ${r.status} ${await r.text()}`);
    const data = await r.json();
    const status = data.status ?? data.state;
    console.log(`  status: ${status}`);
    if (["completed", "succeeded", "done"].includes(status)) return data;
    if (["failed", "error"].includes(status)) throw new Error(`Job failed:\n${JSON.stringify(data, null, 2)}`);
    await new Promise((res) => setTimeout(res, interval));
  }
  throw new Error("Timed out waiting for the job to finish.");
}

function extractVideoUrl(result) {
  // Best-effort only — see file header.
  const candidates = [
    (d) => d.jobs[0].results.raw.url,
    (d) => d.jobs[0].result.url,
    (d) => d.jobs[0].output.video_url,
    (d) => d.result.video_url,
    (d) => d.output_url,
  ];
  for (const get of candidates) {
    try {
      const v = get(result);
      if (v) return v;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function parseArgs(argv) {
  const args = { quality: "high", duration: 5, out: "result.json" };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    args[key] = argv[i + 1];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const req of ["image-url", "audio-url", "prompt"]) {
    if (!args[req]) {
      console.error(
        "Usage: node generate-talking-ad.mjs --image-url <url> --audio-url <url> --prompt <text> [--quality high|mid] [--duration 5|10|15] [--out result.json]"
      );
      process.exit(1);
    }
  }

  console.log("Submitting job...");
  const submitted = await submitTalkingHead({
    imageUrl: args["image-url"],
    audioUrl: args["audio-url"],
    prompt: args.prompt,
    quality: args.quality,
    duration: Number(args.duration),
  });
  const jobSetId = submitted.id;
  if (!jobSetId) {
    console.error(`No job id in submit response:\n${JSON.stringify(submitted, null, 2)}`);
    process.exit(1);
  }
  console.log(`Job set id: ${jobSetId}`);

  console.log("Waiting for it to finish (polling every 5s)...");
  const result = await pollJobSet(jobSetId);

  writeFileSync(args.out, JSON.stringify(result, null, 2));
  console.log(`Full response saved to ${args.out}`);

  const videoUrl = extractVideoUrl(result);
  if (videoUrl) {
    console.log(`\nVideo URL: ${videoUrl}`);
  } else {
    console.log("\nCouldn't find the video URL automatically in the response.");
    console.log(`Open ${args.out}, find it by hand, and send it back to fix the extraction logic.`);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
