import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "BLEME · L’IA qui s’occupe de vos impayés, litiges et démarches",
    template: "%s · BLEME",
  },
  description:
    "BLEME est l’assistant IA des artisans, freelances et TPE pour récupérer les factures impayées, gérer les litiges clients et suivre les démarches : relances cadencées, mise en demeure, dossier prêt pour un professionnel. 0 €/mois, dossiers à partir de 19 € HT.",
  keywords: [
    "facture impayée",
    "relance client",
    "mise en demeure",
    "recouvrement artisan",
    "litige client",
    "indemnité forfaitaire 40 euros",
    "IA juridique",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: "BLEME",
    title: "BLEME · L’IA qui s’occupe de vos impayés, litiges et démarches",
    description:
      "Racontez votre blème à voix haute : l’IA monte le dossier, prépare les courriers et suit chaque étape jusqu’au paiement. Vous validez, ça avance.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "BLEME, l’IA qui s’occupe de vos problèmes" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BLEME · L’IA qui s’occupe de vos impayés, litiges et démarches",
    description:
      "Impayés, litiges, démarches : l’IA qui s’occupe de vos problèmes. 0 €/mois, dossiers à partir de 19 € HT.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
