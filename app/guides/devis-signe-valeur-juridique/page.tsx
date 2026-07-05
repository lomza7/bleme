import type { Metadata } from "next";
import Link from "next/link";
import { GuideFaq, GuideShell, guideJsonLd } from "@/components/guides/guide-shell";
import { JsonLd } from "@/components/seo/json-ld";

const TITLE = "Devis signé : quelle valeur juridique, quelles obligations";
const DESCRIPTION =
  "Un devis signé avec la mention « bon pour accord » forme un contrat qui engage les deux parties : le professionnel sur le prix et la prestation, le client sur le paiement. Mentions indispensables, travaux supplémentaires, acompte, durée de validité : ce que le devis change en cas d'impayé ou de litige.";
const UPDATED = "5 juillet 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/devis-signe-valeur-juridique" },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  {
    q: "Le client a signé le devis puis se rétracte : que peut-il faire ?",
    r: "Entre professionnels, le devis signé engage : la rétractation unilatérale est une inexécution du contrat. Face à un particulier, tout dépend du contexte de signature : un contrat conclu à distance ou hors établissement (chez le client après démarchage) ouvre un droit de rétractation de 14 jours ; un devis signé dans vos locaux ou pour des travaux urgents demandés par le client, en principe non.",
  },
  {
    q: "J'ai fait les travaux sans devis signé : puis-je quand même me faire payer ?",
    r: "C'est possible mais plus difficile. Entre professionnels, la preuve est libre : emails, commencement d'exécution accepté, paiement d'un acompte peuvent établir l'accord. Face à un particulier, au-delà de 1 500 €, un écrit est en principe exigé ; les échanges écrits et l'acompte versé peuvent servir de commencement de preuve, complétés par d'autres éléments. Dans tous les cas, le dossier est fragile comparé à un devis signé.",
  },
  {
    q: "Combien de temps un devis reste-t-il valable ?",
    r: "La durée que vous y indiquez : c'est une mention à ne jamais omettre (30 jours est l'usage courant). Sans mention, le devis reste une offre valable pendant un « délai raisonnable », notion floue qui ouvre des discussions — surtout quand les prix des matériaux bougent.",
  },
  {
    q: "Le client refuse de payer des travaux supplémentaires demandés oralement : que faire ?",
    r: "Les travaux hors devis sont la première source de litiges du bâtiment. Sans accord écrit (avenant, email, SMS de confirmation), prouver la commande est délicat : rassemblez tout ce qui montre la demande et l'acceptation du client (messages, photos datées, témoignages). Pour l'avenir : jamais de travaux supplémentaires sans un écrit, même bref.",
  },
  {
    q: "Un devis signé électroniquement a-t-il la même valeur ?",
    r: "Oui. La signature électronique est reconnue par le Code civil (article 1367), et un devis accepté par un procédé fiable d'acceptation en ligne engage comme un devis papier. Même un accord clair par email (« devis accepté, vous pouvez commencer ») constitue une acceptation, quoique moins formelle.",
  },
];

export default function Page() {
  return (
    <GuideShell title={TITLE} updated={UPDATED}>
      {guideJsonLd({
        slug: "devis-signe-valeur-juridique",
        title: TITLE,
        description: DESCRIPTION,
        updated: "2026-07-05",
        faq: FAQ,
      }).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}

      <p>
        <strong>Un devis est une offre de contrat ; signé par le client avec
        la mention « bon pour accord », il devient un contrat qui engage
        les deux parties : vous, sur la prestation décrite et le prix
        convenu ; le client, sur le paiement.</strong> En cas d’impayé ou de
        contestation, le devis signé est la pièce maîtresse du dossier —
        celle qui établit ce qui a été commandé, à quel prix, dans quels
        délais. Sa qualité de rédaction décide souvent de l’issue d’un
        litige des mois plus tard.
      </p>

      <h2>Les mentions qui protègent</h2>
      <ul>
        <li>
          <strong>Identité complète des deux parties</strong> :
          dénomination, adresse, SIRET côté pro.
        </li>
        <li>
          <strong>Description précise de la prestation</strong> : le poste
          « rénovation salle de bain » invite au litige ; le détail par
          poste (dépose, plomberie, carrelage 24 m², fournitures) le ferme.
        </li>
        <li>
          <strong>Prix</strong> : HT, TVA, TTC, et ce qui n’est pas compris.
        </li>
        <li>
          <strong>Conditions de paiement</strong> : acompte, échéances,
          solde — avec les{" "}
          <Link href="/guides/delais-de-paiement-entre-professionnels">
            délais
          </Link>{" "}
          et, en B2B, la mention des{" "}
          <Link href="/guides/penalites-de-retard">pénalités de retard</Link>{" "}
          et de l’indemnité de 40 €.
        </li>
        <li>
          <strong>Délai d’exécution et durée de validité du devis</strong>.
        </li>
        <li>
          <strong>Date et signature du client</strong> précédée de « bon
          pour accord » : c’est elle qui scelle le contrat.
        </li>
      </ul>

      <h2>Ce que le devis signé change en cas d’impayé</h2>
      <p>
        Toute la mécanique de recouvrement s’appuie dessus : la{" "}
        <Link href="/guides/relance-facture-impayee">relance</Link> cite un
        engagement précis, la{" "}
        <Link href="/guides/mise-en-demeure-de-payer">mise en demeure</Link>{" "}
        vise un contrat daté, et l’
        <Link href="/guides/injonction-de-payer">injonction de payer</Link>{" "}
        exige littéralement une « créance d’origine contractuelle » — le
        devis signé en est la démonstration la plus simple. Sans lui, chaque
        étape demande de reconstituer l’accord par des indices ; avec lui,
        le débat se réduit à « avez-vous payé ? ».
      </p>

      <h2>Travaux supplémentaires : la règle d’or de l’avenant</h2>
      <p>
        Le scénario classique : en cours de chantier, le client demande
        « tant qu’on y est » une modification, l’artisan s’exécute, puis la
        facture finale est contestée sur ces postes. La parade tient en une
        phrase : <strong>aucun travail hors devis sans un écrit</strong>,
        même minimal — un avenant signé idéalement, à défaut un SMS ou un
        email de confirmation (« Suite à votre demande de ce matin :
        remplacement du receveur par un modèle extra-plat, +480 € TTC.
        Confirmez-moi par retour »). Ces messages sont des preuves
        recevables :{" "}
        <Link href="/guides/preuves-impaye-litige">
          voir ce que valent emails et WhatsApp
        </Link>
        .
      </p>

      <h2>Cas particuliers avec les clients particuliers</h2>
      <ul>
        <li>
          <strong>Devis réglementairement obligatoire</strong> pour la
          plupart des travaux de bâtiment, dépannage et réparation au-delà
          de 150 €, et quel que soit le montant sur demande du client.
        </li>
        <li>
          <strong>Écrit exigé au-delà de 1 500 €</strong> pour prouver le
          contrat (article 1359 du Code civil) : le devis signé n’est pas
          un confort, c’est votre preuve.
        </li>
        <li>
          <strong>Rétractation de 14 jours</strong> si le contrat a été
          conclu hors établissement : point de vigilance avant de commencer
          les travaux trop vite.
        </li>
        <li>
          Le régime complet du recouvrement B2C :{" "}
          <Link href="/guides/facture-impayee-client-particulier">
            Facture impayée par un particulier
          </Link>
          .
        </li>
      </ul>

      <GuideFaq items={FAQ} />
    </GuideShell>
  );
}
