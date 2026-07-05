import type { MetadataRoute } from "next";

const BASE = "https://bleme-two.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${BASE}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/nouveau`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/guides`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/guides/facture-impayee-que-faire`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/guides/mise-en-demeure-de-payer`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/guides/indemnite-forfaitaire-40-euros`, lastModified, changeFrequency: "monthly", priority: 0.9 },
  ];
}
