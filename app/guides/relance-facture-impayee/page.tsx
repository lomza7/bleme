import type { Metadata } from "next";
import Link from "next/link";
import { GuideFaq, GuideShell, guideJsonLd } from "@/components/guides/guide-shell";
import { JsonLd } from "@/components/seo/json-ld";

const TITLE = "Relancer une facture impayée : méthode, ton et calendrier";
const DESCRIPTION =
  "Une relance de facture efficace rappelle le numéro de facture, le montant TTC et l'échéance dépassée, par écrit, avec un ton gradué : cordial à J0, ferme à J+7, formel à J+15. Méthode complète, contenu type et erreurs à éviter.";
const UPDATED = "5 juillet 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/relance-facture-impayee" },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  {
    q: "Combien de relances envoyer avant la mise en demeure ?",
    r: "Aucune règle légale n'impose de relancer avant de mettre en demeure. L'usage est d'envoyer une à deux relances écrites (une cordiale, une ferme) : au-delà, multiplier les rappels sans conséquence décrédibilise la démarche et fait perdre du temps sur la prescription.",
  },
  {
    q: "Une relance par téléphone suffit-elle ?",
    r: "Non. Un appel peut débloquer un oubli, mais il ne laisse aucune trace. Si le dossier finit devant un juge, seuls les écrits comptent : doublez chaque échange téléphonique d'un email de confirmation reprenant ce qui a été dit et convenu.",
  },
  {
    q: "Puis-je facturer des frais de relance à mon client ?",
    r: "Entre professionnels, vous pouvez réclamer l'indemnité forfaitaire de recouvrement de 40 € par facture en retard ainsi que les pénalités de retard, dues de plein droit. En revanche, les frais de recouvrement amiable engagés au-delà (courriers, temps passé) restent à la charge du créancier tant qu'il n'a pas de titre exécutoire, sauf indemnisation complémentaire sur justificatifs.",
  },
  {
    q: "La relance interrompt-elle la prescription ?",
    r: "Non. Ni la relance ni même la mise en demeure n'interrompent le délai de prescription (5 ans entre professionnels). Seuls une action en justice, un acte d'exécution forcée ou une reconnaissance de dette par le débiteur l'interrompent. Ne laissez pas les relances repousser indéfiniment la suite.",
  },
  {
    q: "Que faire si le client promet de payer mais ne paie jamais ?",
    r: "Gardez la promesse écrite : un email « je vous règle la semaine prochaine » est une reconnaissance de dette qui interrompt la prescription et affaiblit toute contestation future. À la deuxième promesse non tenue, passez à la mise en demeure : le schéma promesse-silence est un signal classique d'insolvabilité ou de mauvaise foi.",
  },
];

export default function Page() {
  return (
    <GuideShell title={TITLE} updated={UPDATED}>
      {guideJsonLd({
        slug: "relance-facture-impayee",
        title: TITLE,
        description: DESCRIPTION,
        updated: "2026-07-05",
        faq: FAQ,
      }).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}

      <p>
        <strong>Relancer une facture impayée consiste à rappeler par écrit au
        client une somme due dont l’échéance est dépassée, avec un ton qui
        monte progressivement : cordial d’abord, ferme ensuite, formel
        enfin.</strong> La relance n’a aucun formalisme légal obligatoire,
        mais elle obéit à une mécanique éprouvée : la majorité des retards
        sont des oublis ou des priorités mal placées, et une relance bien
        construite règle le problème sans abîmer la relation commerciale.
        Ce guide donne la méthode, le contenu type et le calendrier.
      </p>

      <h2>Ce qu’une bonne relance contient, à chaque fois</h2>
      <ul>
        <li>
          <strong>La référence exacte</strong> : numéro de facture, date
          d’émission, prestation ou chantier concerné.
        </li>
        <li>
          <strong>Le montant TTC restant dû</strong> : après déduction des
          acomptes éventuels, sans ambiguïté.
        </li>
        <li>
          <strong>La date d’échéance dépassée</strong> et le nombre de jours
          de retard.
        </li>
        <li>
          <strong>Le moyen de payer immédiatement</strong> : RIB joint ou
          lien de paiement. Chaque friction retire des chances d’être payé.
        </li>
        <li>
          <strong>La facture en pièce jointe</strong>, même si elle a déjà
          été envoyée : « je ne la retrouve pas » est l’excuse la plus
          fréquente.
        </li>
      </ul>

      <h2>Le ton juste, étape par étape</h2>
      <table>
        <thead>
          <tr>
            <th>Moment</th>
            <th>Ton</th>
            <th>Message clé</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>J0 à J+3 après l’échéance</td>
            <td>Cordial</td>
            <td>« Sans doute un oubli : voici la facture et le RIB. »</td>
          </tr>
          <tr>
            <td>J+7</td>
            <td>Ferme</td>
            <td>
              « Sans règlement sous X jours, nous appliquerons les pénalités
              de retard et l’indemnité de 40 €, et passerons à la mise en
              demeure. »
            </td>
          </tr>
          <tr>
            <td>J+15</td>
            <td>Formel</td>
            <td>
              Mise en demeure en recommandé avec accusé de réception : ce
              n’est plus une relance, c’est un acte qui produit des effets
              juridiques.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Le détail de la dernière étape est dans notre guide{" "}
        <Link href="/guides/mise-en-demeure-de-payer">
          Mise en demeure de payer
        </Link>{" "}
        ; le calendrier complet, recours compris, dans{" "}
        <Link href="/guides/facture-impayee-que-faire">
          Facture impayée : que faire
        </Link>
        .
      </p>

      <h2>La relance ferme : le moment de chiffrer</h2>
      <p>
        C’est à la relance ferme que le rapport de force se joue. Deux
        chiffres changent la lecture du débiteur :{" "}
        <strong>
          l’
          <Link href="/guides/indemnite-forfaitaire-40-euros">
            indemnité forfaitaire de 40 €
          </Link>
        </strong>{" "}
        par facture en retard et{" "}
        <strong>
          les{" "}
          <Link href="/guides/penalites-de-retard">pénalités de retard</Link>
        </strong>
        , tous deux dus de plein droit entre professionnels, sans mise en
        demeure préalable. Une relance qui écrit « au 12 juillet, le retard
        de 47 jours représente 2 400 € + 40 € + 31,58 € d’intérêts » montre
        un créancier qui tient son dossier : c’est celui-là qu’on paie en
        premier.
      </p>

      <h2>Les erreurs qui font perdre du temps ou de l’argent</h2>
      <ul>
        <li>
          <strong>Relancer sans échéance</strong> : « merci de régler
          rapidement » n’engage à rien. Fixez une date précise.
        </li>
        <li>
          <strong>Menacer sans exécuter</strong> : annoncer une mise en
          demeure « sous 8 jours » puis laisser passer un mois apprend au
          débiteur que vos délais sont élastiques.
        </li>
        <li>
          <strong>S’énerver par écrit</strong> : un email agressif ou des
          menaces disproportionnées se retournent contre vous si le dossier
          est produit en justice. Ferme et factuel, toujours.
        </li>
        <li>
          <strong>Tout faire à l’oral</strong> : sans écrit, pas de preuve de
          diligence, et pas de reconnaissance de dette à conserver quand le
          client promet de payer.
        </li>
        <li>
          <strong>Relancer à l’infini</strong> : au-delà de deux relances
          sans effet, chaque semaine supplémentaire joue contre vous. La{" "}
          <Link href="/guides/prescription-facture-impayee">prescription</Link>{" "}
          court depuis l’échéance.
        </li>
      </ul>

      <GuideFaq items={FAQ} />
    </GuideShell>
  );
}
