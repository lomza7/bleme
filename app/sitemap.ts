import type { MetadataRoute } from "next";
import { AGENTS } from "@/lib/agents/data";
import { GUIDES } from "@/lib/guides";
import { SITE_URL } from "@/lib/site";

const BASE = SITE_URL;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${BASE}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    ...AGENTS.map((a) => ({
      url: `${BASE}/agents/${a.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${BASE}/nouveau`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/tarifs`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/guides`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    ...GUIDES.map((g) => ({
      url: `${BASE}/guides/${g.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
  ];
}
