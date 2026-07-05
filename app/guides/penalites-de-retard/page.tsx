import type { Metadata } from "next";
import Link from "next/link";
import { GuideFaq, GuideShell, guideJsonLd } from "@/components/guides/guide-shell";
import { JsonLd } from "@/components/seo/json-ld";

const TITLE = "Pénalités de retard entre professionnels : taux, calcul, mentions obligatoires";
const DESCRIPTION =
  "Les pénalités de retard sont dues de plein droit dès le lendemain de l'échéance, sans rappel nécessaire (article L441-10 du Code de commerce). Taux minimum de 3 fois l'intérêt légal, taux BCE + 10 points à défaut de clause : le guide du calcul et des mentions obligatoires.";
const UPDATED = "5 juillet 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/penalites-de-retard" },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  {
    q: "Les pénalités de retard sont-elles dues même sans relance ?",
    r: "Oui. L'article L441-10 du Code de commerce précise que les pénalités sont exigibles sans qu'un rappel soit nécessaire, dès le jour suivant la date d'échéance. En pratique, beaucoup de créanciers ne les réclament qu'à partir de la relance ferme : c'est un choix commercial, pas une obligation.",
  },
  {
    q: "Quel taux appliquer si mes CGV ne prévoient rien ?",
    r: "À défaut de clause, le taux applicable est le taux directeur de la Banque centrale européenne (taux de refinancement) majoré de 10 points de pourcentage. Si vos CGV prévoient un taux, il ne peut pas être inférieur à 3 fois le taux d'intérêt légal en vigueur.",
  },
  {
    q: "Les pénalités se calculent-elles sur le montant HT ou TTC ?",
    r: "Sur le montant TTC de la facture, position constante de la jurisprudence. Les pénalités de retard elles-mêmes ne sont en revanche pas soumises à TVA.",
  },
  {
    q: "Puis-je cumuler pénalités de retard et indemnité de 40 € ?",
    r: "Oui. Ce sont deux mécanismes distincts et cumulatifs : les pénalités compensent la durée du retard (elles courent jour après jour), l'indemnité forfaitaire de 40 € compense les frais de recouvrement (elle est due une fois par facture en retard). Les deux s'ajoutent au principal.",
  },
  {
    q: "Suis-je obligé de réclamer les pénalités de retard ?",
    r: "Non, y renoncer est un geste commercial possible et courant pour un retard isolé. En revanche, la mention des pénalités dans les CGV et sur les factures est obligatoire, que vous les réclamiez ou non : son absence est passible d'une amende administrative pouvant atteindre 75 000 € pour une personne physique et 2 millions d'euros pour une société.",
  },
];

export default function Page() {
  return (
    <GuideShell title={TITLE} updated={UPDATED}>
      {guideJsonLd({
        slug: "penalites-de-retard",
        title: TITLE,
        description: DESCRIPTION,
        updated: "2026-07-05",
        faq: FAQ,
      }).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}

      <p>
        <strong>Les pénalités de retard sont des intérêts dus par un
        professionnel qui paie une facture après son échéance, de plein
        droit et sans qu’aucun rappel soit nécessaire</strong> (article
        L441-10 du Code de commerce). Elles courent dès le lendemain de la
        date de règlement portée sur la facture et s’ajoutent au principal
        et à l’
        <Link href="/guides/indemnite-forfaitaire-40-euros">
          indemnité forfaitaire de 40 €
        </Link>
        . Peu de créanciers les chiffrent : c’est pourtant l’un des signaux
        les plus efficaces pour se faire payer en priorité.
      </p>

      <h2>Le taux : ce que dit la loi</h2>
      <ul>
        <li>
          <strong>Taux prévu au contrat ou aux CGV</strong> : libre, mais
          jamais inférieur à <strong>3 fois le taux d’intérêt légal</strong>{" "}
          en vigueur.
        </li>
        <li>
          <strong>À défaut de clause</strong> : taux de refinancement de la
          Banque centrale européenne majoré de{" "}
          <strong>10 points de pourcentage</strong> — le taux supplétif le
          plus souvent applicable, et le plus dissuasif.
        </li>
        <li>
          <strong>Actualisation</strong> : le taux d’intérêt légal est
          révisé chaque semestre ; le taux BCE applicable est celui en
          vigueur au 1er janvier ou au 1er juillet du semestre concerné.
        </li>
      </ul>

      <h2>Le calcul, avec un exemple</h2>
      <p>La formule est simple :</p>
      <p>
        <strong>
          pénalités = montant TTC × taux annuel × (jours de retard ÷ 365)
        </strong>
      </p>
      <table>
        <thead>
          <tr>
            <th>Élément</th>
            <th>Exemple</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Facture TTC</td>
            <td>2 400 €</td>
          </tr>
          <tr>
            <td>Taux (BCE + 10 points, hypothèse 12 %)</td>
            <td>12 % annuel</td>
          </tr>
          <tr>
            <td>Retard</td>
            <td>47 jours</td>
          </tr>
          <tr>
            <td>Pénalités</td>
            <td>2 400 × 12 % × 47/365 = <strong>37,08 €</strong></td>
          </tr>
          <tr>
            <td>Total exigible</td>
            <td>2 400 € + 40 € + 37,08 € = <strong>2 477,08 €</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        Le montant peut sembler modeste : son effet ne l’est pas. Une{" "}
        <Link href="/guides/relance-facture-impayee">relance</Link> qui
        détaille ce calcul au centime montre que le dossier est tenu, et une{" "}
        <Link href="/guides/mise-en-demeure-de-payer">mise en demeure</Link>{" "}
        qui l’intègre part sur des bases incontestables.
      </p>

      <h2>Les mentions obligatoires, sous peine d’amende</h2>
      <p>
        Le taux des pénalités de retard et l’indemnité forfaitaire de 40 €
        doivent figurer <strong>dans vos conditions générales de vente et
        sur chaque facture</strong>. L’omission est sanctionnée par une
        amende administrative pouvant atteindre 75 000 € pour une personne
        physique et 2 millions d’euros pour une personne morale. Une ligne
        en pied de facture suffit : « Tout retard de paiement entraîne de
        plein droit des pénalités au taux de X % ainsi qu’une indemnité
        forfaitaire de recouvrement de 40 € (art. L441-10 et D441-5 du Code
        de commerce). »
      </p>

      <h2>Les limites à connaître</h2>
      <ul>
        <li>
          <strong>B2B uniquement</strong> : face à un client particulier, ce
          régime ne s’applique pas — voir{" "}
          <Link href="/guides/facture-impayee-client-particulier">
            Facture impayée par un particulier
          </Link>
          .
        </li>
        <li>
          <strong>Elles se prescrivent avec la créance</strong> :{" "}
          <Link href="/guides/prescription-facture-impayee">5 ans</Link>,
          comme le principal.
        </li>
        <li>
          <strong>Procédure collective</strong> : si le débiteur est en
          redressement ou liquidation, le cours des intérêts est arrêté au
          jugement d’ouverture pour la plupart des créances.
        </li>
      </ul>

      <GuideFaq items={FAQ} />
    </GuideShell>
  );
}
