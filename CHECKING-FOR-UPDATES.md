# Checking for updates from inside the agent itself

If what you deliver is a standalone script or tool, the buyer runs it and
closes the terminal — they may never open agently again. The in-app
notification bell only reaches someone who's looking at the site. This is
the other half: a tiny, silent check the agent itself can run.

`GET /api/version/<slug>` is public, needs no auth, and returns:

```json
{ "slug": "voice-doctor", "name": "Voice Doctor", "version": 3, "updated_at": "2026-08-20T00:00:00.000Z", "page_url": "https://agently-jet.vercel.app/agents/voice-doctor" }
```

`version` only goes up when something that actually matters changed — the
description or the delivery link itself, not a price or category edit (see
`app/api/agents/[id]/route.ts`).

## Python

```python
import urllib.request, json

def check_for_update(slug: str, current_version: int) -> None:
    """Never let a failed check block the agent's real work."""
    try:
        url = f"https://agently-jet.vercel.app/api/version/{slug}"
        with urllib.request.urlopen(url, timeout=2) as r:
            latest = json.loads(r.read())["version"]
        if latest > current_version:
            print(f"⚠ A newer version of this agent is available (v{latest}, you have v{current_version}).")
            print(f"  Get it: https://agently-jet.vercel.app/agents/{slug}")
    except Exception:
        pass

# Call it once near the top of your script, e.g.:
# check_for_update("voice-doctor", CURRENT_VERSION)
```

## Node / JS

```js
async function checkForUpdate(slug, currentVersion) {
  try {
    const res = await fetch(`https://agently-jet.vercel.app/api/version/${slug}`, {
      signal: AbortSignal.timeout(2000),
    });
    const { version } = await res.json();
    if (version > currentVersion) {
      console.warn(`⚠ A newer version of this agent is available (v${version}, you have v${currentVersion}).`);
      console.warn(`  Get it: https://agently-jet.vercel.app/agents/${slug}`);
    }
  } catch {
    // Never block the agent's real work over a failed update check.
  }
}
```

## What this can't do

It's a pull, not a push — the agent has to actually run and call this for
the check to happen. There's no way to force a standalone script to phone
home. If an agent needs guaranteed delivery of updates (not just a notice),
it needs its own auto-update mechanism built by its creator — this only
tells it there's something to fetch.

Track which version you're shipping (`CURRENT_VERSION` above) yourself —
Agently has no way to know what version is actually sitting on a buyer's
machine, only what it last delivered.
