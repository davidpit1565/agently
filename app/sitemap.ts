import type { MetadataRoute } from "next";
import { getApprovedAgents } from "@/lib/catalog";

const SITE_URL = "https://agently-orcin.vercel.app";

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
    lastModified: agent.created_at,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...agentRoutes];
}
