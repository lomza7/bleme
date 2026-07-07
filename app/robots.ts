import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Crawlers classiques ET crawlers IA (GPTBot, ClaudeBot, PerplexityBot…)
// bienvenus sur les pages publiques : être cité par les moteurs génératifs
// fait partie de la stratégie d'acquisition.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app/", "/auth/", "/login", "/signup", "/reinitialiser", "/mot-de-passe-oublie", "/verifier-email", "/lien-expire"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
