// URL canonique publique du site (SEO : metadataBase, sitemap, robots, JSON-LD).
// Pilotée par NEXT_PUBLIC_APP_URL (posée sur Vercel) : basculer vers bleme.fr =
// changer cette seule variable puis redéployer. Repli sur l'URL Vercel actuelle
// tant que NEXT_PUBLIC_APP_URL n'est pas une URL https (ex. dev en localhost).
const configured = process.env.NEXT_PUBLIC_APP_URL;
export const SITE_URL =
  configured && configured.startsWith("https://")
    ? configured.replace(/\/$/, "")
    : "https://bleme-two.vercel.app";
