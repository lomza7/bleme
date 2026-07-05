/** Injecte un bloc JSON-LD (schema.org) dans la page. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "BLEME",
  url: "https://bleme-two.vercel.app",
  logo: "https://bleme-two.vercel.app/icon.png",
  description:
    "BLEME est l'assistant IA des artisans, freelances et TPE pour récupérer les factures impayées, gérer les litiges clients et suivre les démarches administratives.",
  sameAs: ["https://github.com/lomza7/bleme"],
};
