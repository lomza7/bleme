import type { Metadata } from "next";
import Link from "next/link";
import { GuideFaq, GuideShell, guideJsonLd } from "@/components/guides/guide-shell";
import { JsonLd } from "@/components/seo/json-ld";

const TITLE = "Facture impayée : que faire, étape par étape";
const DESCRIPTION =
  "Une facture impayée se traite en 4 étapes : relance amiable, relance ferme, mise en demeure en recommandé, puis recours (injonction de payer). Délais, indemnité de 40 €, prescription de 5 ans : le guide complet pour les pros.";
const UPDATED = "5 juillet 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/facture-impayee-que-faire" },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  {
    q: "Au bout de combien de temps une facture est-elle considérée comme impayée ?",
    r: "Dès le lendemain de sa date d'échéance. Entre professionnels, le délai de paiement par défaut est de 30 jours après réception de la marchandise ou exécution de la prestation, et ne peut pas dépasser 60 jours après émission de la facture (article L441-10 du Code de commerce).",
  },
  {
    q: "Combien de temps ai-je pour agir contre un client professionnel qui ne paie pas ?",
    r: "5 ans à compter de l'échéance pour une créance entre professionnels (article L110-4 du Code de commerce). Face à un client particulier, le délai tombe à 2 ans. Passé ce délai, la créance est prescrite : agissez tôt.",
  },
  {
    q: "La relance est-elle obligatoire avant la mise en demeure ?",
    r: "Non, aucune loi n'impose de relancer avant de mettre en demeure. C'est en revanche l'usage : une relance cordiale préserve la relation commerciale et règle une grande partie des retards simples sans conflit.",
  },
  {
    q: "Que faire si le client conteste la facture au lieu de payer ?",
    r: "L'impayé devient un litige : rassemblez les preuves de l'accord (devis signé, échanges, preuve de livraison) et répondez point par point par écrit. Si le désaccord persiste, la mise en demeure reste possible pour la partie non contestée, et le dossier documenté servira devant le juge.",
  },
  {
    q: "Une injonction de payer coûte-t-elle cher ?",
    r: "La requête en injonction de payer devant le tribunal de commerce coûte environ 35 € de frais de greffe et ne nécessite pas d'avocat. C'est la voie judiciaire la plus simple pour une créance non contestée, à condition d'avoir un dossier complet : facture, preuve de la prestation, mise en demeure.",
  },
];

export default function Page() {
  return (
    <GuideShell title={TITLE} updated={UPDATED}>
      {guideJsonLd({
        slug: "facture-impayee-que-faire",
        title: TITLE,
        description: DESCRIPTION,
        updated: "2026-07-05",
        faq: FAQ,
      }).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}

      <p>
        <strong>Une facture impayée est une facture dont la date d’échéance
        est dépassée sans que le paiement soit intervenu.</strong> Elle se
        traite en quatre étapes graduées : relance amiable, relance ferme,
        mise en demeure envoyée en recommandé, puis recours judiciaire ou
        accompagné. Plus vous agissez tôt et par écrit, plus vos chances de
        récupérer votre argent sont élevées : chaque mois d’attente affaiblit
        la créance, et la prescription (5 ans entre professionnels) court
        depuis l’échéance.
      </p>

      <h2>Étape 1 : la relance amiable (dès l’échéance dépassée)</h2>
      <p>
        La première relance est cordiale : la plupart des retards viennent
        d’un oubli, d’une facture égarée ou d’un problème de trésorerie
        passager. Envoyez un email qui rappelle <strong>le numéro de facture,
        le montant TTC, la date d’échéance dépassée</strong> et joignez la
        facture. Restez factuel et courtois : l’objectif est d’être payé, pas
        d’ouvrir un conflit.
      </p>
      <p>
        Gardez une trace écrite de chaque relance : ces preuves de diligence
        pèseront si le dossier finit devant un juge.
      </p>

      <h2>Étape 2 : la relance ferme (autour de J+7)</h2>
      <p>
        Sans réponse après une semaine, le ton monte d’un cran. La relance
        ferme annonce explicitement la suite : sans règlement sous un délai
        précis, une mise en demeure sera envoyée. C’est aussi le moment de
        rappeler que le retard ouvre droit à des pénalités :{" "}
        <strong>l’indemnité forfaitaire de recouvrement de 40 €</strong> par
        facture et les intérêts de retard, dus de plein droit entre
        professionnels (
        <Link href="/guides/indemnite-forfaitaire-40-euros">
          voir notre guide dédié
        </Link>
        ).
      </p>

      <h2>Étape 3 : la mise en demeure (autour de J+15)</h2>
      <p>
        La mise en demeure est un courrier formel qui exige le paiement sous
        un délai précis et se réserve le droit d’agir en justice. Envoyée en
        recommandé avec accusé de réception, elle{" "}
        <strong>fait courir officiellement les intérêts de retard</strong>{" "}
        (article 1344-1 du Code civil) et constitue le préalable attendu
        avant toute action judiciaire. Mentions indispensables : identité des
        parties, référence de la facture, montant exigé, délai de paiement,
        réserve d’action en justice. Le détail complet est dans notre guide{" "}
        <Link href="/guides/mise-en-demeure-de-payer">
          Mise en demeure de payer
        </Link>
        .
      </p>

      <h2>Étape 4 : les recours si rien ne bouge (à partir de J+30)</h2>
      <ul>
        <li>
          <strong>L’injonction de payer</strong> : procédure rapide et peu
          coûteuse (~35 € de greffe, sans avocat) devant le tribunal de
          commerce, adaptée aux créances non sérieusement contestables.
        </li>
        <li>
          <strong>Le recouvrement par commissaire de justice</strong> : pour
          les créances de moins de 5 000 €, la procédure simplifiée de
          recouvrement (article L125-1 du Code des procédures civiles
          d’exécution) permet d’obtenir un titre exécutoire sans juge.
        </li>
        <li>
          <strong>L’avocat</strong> : indispensable si la créance est
          contestée ou importante. Un dossier complet (facture, devis signé,
          échanges, relances datées, mise en demeure) réduit sensiblement le
          temps facturé.
        </li>
      </ul>

      <h2>Le calendrier type</h2>
      <table>
        <thead>
          <tr>
            <th>Moment</th>
            <th>Action</th>
            <th>Effet</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>J0 (échéance dépassée)</td>
            <td>Relance amiable par email</td>
            <td>Règle la majorité des oublis</td>
          </tr>
          <tr>
            <td>J+7</td>
            <td>Relance ferme, pénalités annoncées</td>
            <td>Montre que vous suivez le dossier</td>
          </tr>
          <tr>
            <td>J+15</td>
            <td>Mise en demeure en recommandé</td>
            <td>Fait courir les intérêts, prépare le recours</td>
          </tr>
          <tr>
            <td>J+30</td>
            <td>Injonction de payer ou professionnel</td>
            <td>Titre exécutoire contre le débiteur</td>
          </tr>
        </tbody>
      </table>

      <h2>Les erreurs qui coûtent cher</h2>
      <ul>
        <li>
          <strong>Attendre en silence</strong> : sans relance écrite, le
          débiteur vous classe parmi les créanciers qui n’insisteront pas.
        </li>
        <li>
          <strong>Tout faire par téléphone</strong> : un appel ne laisse
          aucune preuve. Doublez chaque échange oral d’un écrit.
        </li>
        <li>
          <strong>Menacer sans agir</strong> : une mise en demeure restée
          sans suite pendant des mois décrédibilise les suivantes.
        </li>
        <li>
          <strong>Laisser filer la prescription</strong> : 5 ans passent
          vite, surtout quand la relation commerciale continue.
        </li>
      </ul>

      <GuideFaq items={FAQ} />
    </GuideShell>
  );
}
