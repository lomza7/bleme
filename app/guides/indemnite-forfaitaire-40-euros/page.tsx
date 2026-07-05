import type { Metadata } from "next";
import Link from "next/link";
import { GuideFaq, GuideShell, guideJsonLd } from "@/components/guides/guide-shell";
import { JsonLd } from "@/components/seo/json-ld";

const TITLE = "Indemnité forfaitaire de 40 € : la pénalité de retard automatique";
const DESCRIPTION =
  "L'indemnité forfaitaire de recouvrement de 40 € est due de plein droit pour chaque facture payée en retard entre professionnels (articles L441-10 et D441-5 du Code de commerce). Qui peut la réclamer, comment, et ce qu'elle change dans une relance.";
const UPDATED = "5 juillet 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/indemnite-forfaitaire-40-euros" },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  {
    q: "L'indemnité de 40 € s'applique-t-elle aux clients particuliers ?",
    r: "Non. L'indemnité forfaitaire de recouvrement ne concerne que les relations entre professionnels (B2B). Face à un consommateur, ce sont les pénalités prévues au contrat et les intérêts légaux qui s'appliquent, avec les protections du Code de la consommation.",
  },
  {
    q: "Dois-je prévoir l'indemnité de 40 € dans mes CGV pour pouvoir la réclamer ?",
    r: "Elle est due de plein droit, même sans clause. En revanche, la loi impose de la mentionner dans vos conditions générales de vente et sur vos factures : l'absence de mention est passible d'une amende administrative (jusqu'à 75 000 € pour une personne physique, 2 millions d'euros pour une société).",
  },
  {
    q: "L'indemnité est-elle de 40 € par facture ou par client ?",
    r: "Par facture payée en retard. Dix factures en retard chez le même client = 400 € d'indemnités forfaitaires, en plus du principal et des intérêts.",
  },
  {
    q: "Puis-je réclamer plus de 40 € si le recouvrement m'a coûté davantage ?",
    r: "Oui : lorsque les frais réels de recouvrement dépassent 40 € (par exemple des honoraires de commissaire de justice ou d'avocat), une indemnisation complémentaire peut être demandée sur justificatifs (article L441-10 II du Code de commerce).",
  },
  {
    q: "Quel est le taux des intérêts de retard entre professionnels ?",
    r: "Le taux prévu au contrat, qui ne peut être inférieur à 3 fois le taux d'intérêt légal. À défaut de clause, s'applique le taux directeur de la BCE majoré de 10 points. Ces intérêts courent de plein droit dès le lendemain de l'échéance, sans même qu'une relance soit nécessaire.",
  },
];

export default function Page() {
  return (
    <GuideShell title={TITLE} updated={UPDATED}>
      {guideJsonLd({
        slug: "indemnite-forfaitaire-40-euros",
        title: TITLE,
        description: DESCRIPTION,
        updated: "2026-07-05",
        faq: FAQ,
      }).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}

      <p>
        <strong>L’indemnité forfaitaire de recouvrement est une somme de
        40 € due automatiquement au créancier pour chaque facture payée en
        retard entre professionnels</strong>, prévue par l’article L441-10 du
        Code de commerce et fixée par l’article D441-5. « De plein droit »
        signifie qu’elle est due sans mise en demeure préalable, sans clause
        contractuelle, dès le premier jour de retard — c’est l’arme la plus
        simple et la plus méconnue des créanciers.
      </p>

      <h2>Ce que dit précisément la loi</h2>
      <ul>
        <li>
          <strong>Qui</strong> : toute entreprise créancière face à un
          débiteur professionnel (B2B uniquement).
        </li>
        <li>
          <strong>Combien</strong> : 40 € par facture en retard, forfaitaires
          — sans justificatif de frais à produire.
        </li>
        <li>
          <strong>Quand</strong> : dès le lendemain de l’échéance, en plus des
          intérêts de retard et du principal.
        </li>
        <li>
          <strong>Mention obligatoire</strong> : l’indemnité doit figurer dans
          les CGV et sur chaque facture ; l’omission est sanctionnée par une
          amende administrative.
        </li>
      </ul>

      <h2>Pourquoi la réclamer change vos relances</h2>
      <p>
        Réclamer l’indemnité n’est pas (seulement) une question de 40 € :
        c’est un <strong>signal de sérieux</strong>. Une relance qui chiffre
        précisément « principal + 40 € d’indemnité légale + intérêts »
        montre au débiteur que le créancier connaît ses droits et documente
        son dossier — exactement le profil de créancier que l’on paie en
        premier. À l’inverse, y renoncer systématiquement installe l’idée que
        vos échéances sont indicatives.
      </p>

      <h2>Comment la calculer et la facturer</h2>
      <table>
        <thead>
          <tr>
            <th>Situation</th>
            <th>Ce qui est dû</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1 facture de 2 400 € payée avec 47 jours de retard</td>
            <td>2 400 € + 40 € + intérêts de retard sur 47 jours</td>
          </tr>
          <tr>
            <td>3 factures en retard chez le même client</td>
            <td>Principal + 120 € d’indemnités (40 € × 3) + intérêts</td>
          </tr>
          <tr>
            <td>Frais de recouvrement réels supérieurs (commissaire, avocat)</td>
            <td>Indemnisation complémentaire possible sur justificatifs</td>
          </tr>
        </tbody>
      </table>
      <p>
        En pratique : mentionnez l’indemnité dès la{" "}
        <Link href="/guides/facture-impayee-que-faire">relance ferme</Link>,
        chiffrez-la dans la{" "}
        <Link href="/guides/mise-en-demeure-de-payer">mise en demeure</Link>,
        et intégrez-la au montant réclamé dans une éventuelle injonction de
        payer.
      </p>

      <h2>Les limites à connaître</h2>
      <ul>
        <li>
          <strong>B2B uniquement</strong> : rien de tel face à un
          consommateur.
        </li>
        <li>
          <strong>Pas due si le débiteur est en procédure collective</strong>{" "}
          (redressement ou liquidation judiciaire) au moment où elle serait
          exigible.
        </li>
        <li>
          <strong>Elle se prescrit avec la créance</strong> : 5 ans, comme le
          principal.
        </li>
      </ul>

      <GuideFaq items={FAQ} />
    </GuideShell>
  );
}
