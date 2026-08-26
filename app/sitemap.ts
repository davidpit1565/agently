import type { MetadataRoute } from "next";
import { getApprovedAgents } from "@/lib/catalog";

const SITE_URL = "https://agently-jet.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const agents = await getApprovedAgents();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/browse`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/pricing`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.4 },
  ];

  const agentRoutes: MetadataRoute.Sitemap = agents.map((agent) => ({
    url: `${SITE_URL}/agents/${agent.slug}`,
    lastModified: agent.updated_at,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Creator pages were never in here at all — real, indexable content
  // (getApprovedAgents already has everything needed to derive the list,
  // no separate query).
  const creatorIds = [...new Set(agents.map((agent) => agent.creator_id))];
  const creatorRoutes: MetadataRoute.Sitemap = creatorIds.map((id) => ({
    url: `${SITE_URL}/creators/${id}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...agentRoutes, ...creatorRoutes];
}
