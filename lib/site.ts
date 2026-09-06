// The app has no custom domain yet — this literal used to be typed out
// separately in app/robots.ts, app/sitemap.ts, app/layout.tsx,
// app/api/version/[slug]/route.ts, lib/notifications.ts, lib/team-invites.ts,
// and lib/watermark.ts. One constant here instead: when a custom domain
// does show up, it changes in one place instead of needing a grep across
// seven files to find every copy.
export const SITE_URL = "https://agently-jet.vercel.app";
