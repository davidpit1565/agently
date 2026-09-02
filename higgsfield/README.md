# higgsfield/ — talking-head ad clips via the Higgsfield API

**Unrelated to the rest of this repo** (an AI-agent marketplace) — added
here on request, as a standalone script, not wired into the app or its
Vercel deployment. Same tool as the one added to `videos-ai/higgsfield/`,
ported to plain Node (no extra dependencies) to match this repo's stack.

Wraps Higgsfield's "Speak v2" endpoint to generate a talking-head clip
from a portrait image + narration audio, without touching Higgsfield's
consumer web app.

## Setup (one time)

```bash
cp higgsfield/.env.example higgsfield/.env
# then edit higgsfield/.env and fill in HF_API_KEY / HF_SECRET
# from https://cloud.higgsfield.ai/api-keys
```

`.env` is already covered by the repo's `.gitignore` (`.env` pattern) — it
never gets committed, same as every other secret in this repo (which
otherwise all live in Vercel's environment variables, per the root
`.env.example`'s own instructions — this one's just a local script, so a
local `.env` is the right place for it instead).

## Usage

```bash
node higgsfield/generate-talking-ad.mjs \
  --image-url "https://.../portrait.jpg" \
  --audio-url "https://.../narration.wav" \
  --prompt "handheld selfie-style UGC ad, warm lighting" \
  --duration 10
```

Both `--image-url` and `--audio-url` must already be publicly reachable
URLs — Higgsfield's API fetches from them, it doesn't accept local file
uploads directly. Host a local file somewhere reachable first before
passing it in.

The script polls until the job finishes, saves the full raw response to
`--out` (default `result.json`), and tries to pull the finished video's
URL out of it automatically.

## What's verified vs. what isn't

- **Verified** (from Higgsfield's own open-source MCP integration,
  github.com/QalaLabs/claude-higgsfield-mcp): the base URL
  (`platform.higgsfield.ai`), the endpoint (`POST /v1/speak/higgsfield`),
  the auth header shape (`Authorization: Key {api_key}:{secret}`), the
  request body shape, the polling endpoint (`GET /v1/job-sets/{id}`), and
  the submit response's top-level shape (`{"id", "type", "jobs"}`).
- **Not verified — flagging honestly rather than guessing**: the exact
  field path to the finished video's URL inside a *completed* job-set
  response. `extractVideoUrl()` tries a few plausible paths and falls
  back to just saving the raw JSON.

**First real run**: if `extractVideoUrl()` comes up empty, open the saved
JSON, find the real field by hand, and send it back — that one data point
fixes the extraction logic for every run after it.

## Cost

Talking-head generation is a metered, paid feature on Higgsfield (same
account/credits as the consumer app) — this script automates the same
paid call instead of clicking through the web UI for it, it doesn't make
it free.
