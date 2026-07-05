import type { Metadata } from "next";
import Link from "next/link";
import { GuideFaq, GuideShell, guideJsonLd } from "@/components/guides/guide-shell";
import { JsonLd } from "@/components/seo/json-ld";

const TITLE = "Prescription d'une facture impayée : combien de temps pour agir";
const DESCRIPTION =
  "Une facture impayée se prescrit par 5 ans entre professionnels (article L110-4 du Code de commerce) et par 2 ans quand le client est un particulier (article L218-2 du Code de la consommation), à compter de l'échéance. Ce qui interrompt le délai, ce qui ne l'interrompt pas, et les pièges à éviter.";
const UPDATED = "5 juillet 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/prescription-facture-impayee" },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  {
    q: "Une mise en demeure interrompt-elle la prescription ?",
    r: "Non, et c'est le piège le plus répandu : ni la relance, ni la mise en demeure, même en recommandé, n'interrompent la prescription. Seuls une demande en justice (assignation, requête en injonction de payer), un acte d'exécution forcée ou une reconnaissance de la dette par le débiteur ont cet effet.",
  },
  {
    q: "Un email du client promettant de payer interrompt-il le délai ?",
    r: "Oui. La reconnaissance par le débiteur du droit du créancier interrompt la prescription (article 2240 du Code civil), et elle peut résulter d'un email, d'un SMS, d'une demande de délai ou d'un paiement partiel. Conservez précieusement ces messages : ils font repartir un délai complet.",
  },
  {
    q: "Que devient une facture prescrite ?",
    r: "La dette n'est pas effacée mais elle n'est plus exigible en justice : si vous assignez, le débiteur peut opposer la prescription et gagner sans débat sur le fond. Un paiement volontaire d'une dette prescrite reste toutefois valable et ne peut pas être réclamé en retour.",
  },
  {
    q: "Le délai repart-il à zéro après une interruption ?",
    r: "Oui : l'interruption efface le délai écoulé et fait courir un nouveau délai de même durée. Une reconnaissance de dette signée en 2026 sur une facture de 2024 vous redonne 5 ans à compter de la reconnaissance.",
  },
  {
    q: "Quand exactement le délai commence-t-il à courir ?",
    r: "À compter de l'exigibilité de la créance, c'est-à-dire le lendemain de la date d'échéance portée sur la facture. Pour une facture sans échéance explicite, le délai par défaut de 30 jours après exécution de la prestation sert de repère entre professionnels.",
  },
];

export default function Page() {
  return (
    <GuideShell title={TITLE} updated={UPDATED}>
      {guideJsonLd({
        slug: "prescription-facture-impayee",
        title: TITLE,
        description: DESCRIPTION,
        updated: "2026-07-05",
        faq: FAQ,
      }).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}

      <p>
        <strong>La prescription est le délai au-delà duquel une facture
        impayée ne peut plus être réclamée en justice : 5 ans entre
        professionnels (article L110-4 du Code de commerce), 2 ans
        seulement lorsque le débiteur est un consommateur</strong> (article
        L218-2 du Code de la consommation). Le compte à rebours démarre à
        l’échéance de la facture, et il court même pendant que vous
        relancez : des années de relances polies peuvent mener tout droit à
        une créance juridiquement morte. C’est la donnée de fond de toute
        stratégie de recouvrement.
      </p>

      <h2>Les deux délais à retenir</h2>
      <table>
        <thead>
          <tr>
            <th>Votre client</th>
            <th>Délai</th>
            <th>Texte</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Professionnel (société, commerçant, indépendant)</td>
            <td><strong>5 ans</strong> depuis l’échéance</td>
            <td>Art. L110-4 Code de commerce</td>
          </tr>
          <tr>
            <td>Particulier (consommateur)</td>
            <td><strong>2 ans</strong> depuis l’échéance</td>
            <td>Art. L218-2 Code de la consommation</td>
          </tr>
        </tbody>
      </table>
      <p>
        Le régime complet face à un client particulier (écrit exigé,
        indemnité de 40 € inapplicable) est détaillé dans{" "}
        <Link href="/guides/facture-impayee-client-particulier">
          Facture impayée par un particulier
        </Link>
        .
      </p>

      <h2>Ce qui interrompt la prescription (le délai repart à zéro)</h2>
      <ul>
        <li>
          <strong>Une demande en justice</strong> : assignation ou requête
          en{" "}
          <Link href="/guides/injonction-de-payer">injonction de payer</Link>
          , même en référé.
        </li>
        <li>
          <strong>Un acte d’exécution forcée</strong> : saisie pratiquée par
          commissaire de justice.
        </li>
        <li>
          <strong>Une reconnaissance de la dette par le débiteur</strong> :
          paiement partiel, demande d’échéancier, email « je vous règle dès
          que possible ». C’est l’interruption la plus accessible — et une
          raison de plus de tout garder par écrit.
        </li>
      </ul>

      <h2>Ce qui n’interrompt PAS la prescription</h2>
      <ul>
        <li>
          <strong>Les relances</strong>, même nombreuses, même en
          recommandé.
        </li>
        <li>
          <strong>La mise en demeure</strong> : elle produit d’autres effets
          (intérêts, préalable au recours) mais ne touche pas au délai.
        </li>
        <li>
          <strong>Les appels téléphoniques et rendez-vous</strong> sans
          écrit du débiteur.
        </li>
        <li>
          <strong>Le dépôt du dossier chez un tiers</strong> (société de
          recouvrement, avocat) tant qu’aucune action n’est engagée.
        </li>
      </ul>
      <p>
        À noter : une médiation ou une conciliation formelle{" "}
        <strong>suspend</strong> la prescription (le délai s’arrête puis
        reprend où il en était), ce qui est moins puissant qu’une
        interruption mais protège pendant la négociation.
      </p>

      <h2>En pratique : le calendrier qui protège</h2>
      <p>
        La prescription ne devrait jamais être un sujet : un impayé traité
        au bon rythme —{" "}
        <Link href="/guides/relance-facture-impayee">relances</Link> dans le
        mois,{" "}
        <Link href="/guides/mise-en-demeure-de-payer">mise en demeure</Link>{" "}
        à J+15, recours à J+30 — se règle des années avant l’échéance
        fatidique. Le danger vient des dossiers qu’on laisse dormir « parce
        que le client va payer » : datez chaque créance, notez son échéance
        de prescription, et fixez-vous un point de non-retour. C’est
        exactement le rôle du suivi automatique des dossiers dans BLEME.
      </p>

      <GuideFaq items={FAQ} />
    </GuideShell>
  );
}
