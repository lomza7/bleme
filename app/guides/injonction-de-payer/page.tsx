import type { Metadata } from "next";
import Link from "next/link";
import { GuideFaq, GuideShell, guideJsonLd } from "@/components/guides/guide-shell";
import { JsonLd } from "@/components/seo/json-ld";

const TITLE = "Injonction de payer : la procédure pas à pas, coûts et délais";
const DESCRIPTION =
  "L'injonction de payer est une procédure judiciaire rapide et peu coûteuse (environ 35 € de frais de greffe au tribunal de commerce, sans avocat obligatoire) pour obtenir un titre exécutoire contre un débiteur qui ne conteste pas sérieusement la créance. Requête, pièces, signification, opposition : le déroulé complet.";
const UPDATED = "5 juillet 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/injonction-de-payer" },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  {
    q: "Faut-il un avocat pour une injonction de payer ?",
    r: "Non. La requête en injonction de payer se dépose sans avocat, quel que soit le montant. Un dossier bien préparé (facture, devis signé, mise en demeure avec accusé de réception) suffit ; c'est précisément une procédure conçue pour être accessible aux créanciers eux-mêmes.",
  },
  {
    q: "Combien coûte une injonction de payer ?",
    r: "Devant le tribunal de commerce, les frais de greffe sont d'environ 35 €. Devant le tribunal judiciaire (débiteur non commerçant), la requête est gratuite. S'ajoute le coût de la signification de l'ordonnance par commissaire de justice (quelques dizaines d'euros), avancé par le créancier et en partie récupérable sur le débiteur.",
  },
  {
    q: "Quel tribunal est compétent pour ma requête ?",
    r: "Le tribunal de commerce si votre débiteur est une société commerciale ou un commerçant ; le tribunal judiciaire s'il est artisan non commerçant, association ou particulier. Territorialement, c'est le tribunal du domicile ou du siège du débiteur. Pour les tribunaux de commerce, la requête peut se faire en ligne via le Tribunal digital.",
  },
  {
    q: "Que se passe-t-il si le débiteur fait opposition ?",
    r: "L'opposition, possible dans le mois qui suit la signification, transforme la procédure en instance classique : les deux parties sont convoquées et le juge tranche après débat. C'est pourquoi l'injonction de payer est réservée aux créances non sérieusement contestables : si un vrai litige existe, mieux vaut le traiter en amont.",
  },
  {
    q: "L'ordonnance obtenue, comment récupérer concrètement l'argent ?",
    r: "Une fois l'ordonnance revêtue de la formule exécutoire (à demander dans le mois suivant l'expiration du délai d'opposition), elle devient un titre exécutoire : un commissaire de justice peut alors pratiquer une saisie sur les comptes bancaires du débiteur, ses créances clients ou ses biens.",
  },
];

export default function Page() {
  return (
    <GuideShell title={TITLE} updated={UPDATED}>
      {guideJsonLd({
        slug: "injonction-de-payer",
        title: TITLE,
        description: DESCRIPTION,
        updated: "2026-07-05",
        faq: FAQ,
      }).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}

      <p>
        <strong>L’injonction de payer est une procédure judiciaire qui
        permet à un créancier d’obtenir, sans procès ni avocat, une
        ordonnance condamnant le débiteur à payer une créance dont le
        montant est déterminé et qui résulte d’un contrat.</strong> C’est la
        voie judiciaire la plus simple et la moins chère pour une facture
        impayée non sérieusement contestée : le juge statue sur pièces, sans
        audience, et l’ordonnance devient un titre exécutoire permettant la
        saisie. Elle vient après l’échec de la phase amiable — relances puis{" "}
        <Link href="/guides/mise-en-demeure-de-payer">mise en demeure</Link>.
      </p>

      <h2>Les conditions pour y recourir</h2>
      <ul>
        <li>
          <strong>Une créance contractuelle</strong> : facture issue d’un
          devis, d’un contrat, d’une commande.
        </li>
        <li>
          <strong>Un montant déterminé</strong> : la somme exacte, pénalités
          et indemnité de 40 € comprises si vous les réclamez.
        </li>
        <li>
          <strong>Une créance exigible</strong> : échéance dépassée et{" "}
          <Link href="/guides/prescription-facture-impayee">
            prescription
          </Link>{" "}
          non acquise.
        </li>
        <li>
          <strong>Pas de contestation sérieuse</strong> : si le client
          conteste la qualité des travaux ou la réalité de la prestation,
          l’opposition est quasi certaine — traitez d’abord le{" "}
          <Link href="/guides/client-conteste-travaux-facture">litige</Link>.
        </li>
      </ul>

      <h2>Le déroulé, étape par étape</h2>
      <table>
        <thead>
          <tr>
            <th>Étape</th>
            <th>Qui</th>
            <th>Délai indicatif</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1. Dépôt de la requête avec les pièces</td>
            <td>Vous (ou en ligne, Tribunal digital)</td>
            <td>1 jour de préparation</td>
          </tr>
          <tr>
            <td>2. Examen sur pièces et ordonnance</td>
            <td>Le juge</td>
            <td>Quelques semaines</td>
          </tr>
          <tr>
            <td>3. Signification au débiteur</td>
            <td>Commissaire de justice</td>
            <td>Sous 6 mois maximum</td>
          </tr>
          <tr>
            <td>4. Délai d’opposition</td>
            <td>Le débiteur</td>
            <td>1 mois après signification</td>
          </tr>
          <tr>
            <td>5. Formule exécutoire puis saisie possible</td>
            <td>Vous, puis commissaire de justice</td>
            <td>Dès l’expiration du délai</td>
          </tr>
        </tbody>
      </table>

      <h2>Les pièces qui font accepter la requête</h2>
      <p>
        Le juge statue uniquement sur votre dossier : sa qualité fait la
        décision. Le socle : <strong>la facture impayée, le devis signé ou
        le contrat, la preuve d’exécution</strong> (bon de livraison,
        procès-verbal de réception, échanges), <strong>les relances et la
        mise en demeure avec son accusé de réception</strong>. Un dossier
        ordonné et daté — exactement ce qu’un dossier BLEME exporte — évite
        le rejet pour insuffisance de justificatifs. Sur ce que valent vos
        emails et messages :{" "}
        <Link href="/guides/preuves-impaye-litige">
          quelles preuves comptent vraiment
        </Link>
        .
      </p>

      <h2>Injonction de payer ou procédure simplifiée ?</h2>
      <p>
        Pour les créances inférieures à 5 000 €, une alternative existe sans
        passer par le juge : la{" "}
        <Link href="/guides/recouvrement-creance-moins-5000-euros">
          procédure simplifiée de recouvrement
        </Link>{" "}
        par commissaire de justice. Plus rapide quand le débiteur coopère,
        mais elle suppose son accord ; l’injonction de payer, elle, aboutit
        même si le débiteur fait le mort — c’est son grand avantage face aux
        silencieux.
      </p>

      <GuideFaq items={FAQ} />
    </GuideShell>
  );
}
