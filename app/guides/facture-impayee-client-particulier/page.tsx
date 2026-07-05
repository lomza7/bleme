import type { Metadata } from "next";
import Link from "next/link";
import { GuideFaq, GuideShell, guideJsonLd } from "@/components/guides/guide-shell";
import { JsonLd } from "@/components/seo/json-ld";

const TITLE = "Facture impayée par un particulier : ce qui change pour un pro";
const DESCRIPTION =
  "Quand le mauvais payeur est un particulier, les règles changent : prescription de 2 ans seulement (article L218-2 du Code de la consommation), pas d'indemnité forfaitaire de 40 €, intérêts après mise en demeure, et exigence d'un écrit au-delà de 1 500 €. Le guide pour les artisans et indépendants.";
const UPDATED = "5 juillet 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/facture-impayee-client-particulier" },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  {
    q: "Puis-je réclamer l'indemnité de 40 € à un client particulier ?",
    r: "Non. L'indemnité forfaitaire de recouvrement et les pénalités de retard de l'article L441-10 du Code de commerce ne s'appliquent qu'entre professionnels. Face à un particulier, vous pouvez réclamer les intérêts au taux légal à compter de la mise en demeure, et d'éventuelles pénalités si votre devis ou contrat les prévoyait expressément.",
  },
  {
    q: "Pourquoi seulement 2 ans pour agir contre un particulier ?",
    r: "L'article L218-2 du Code de la consommation fixe à 2 ans la prescription de l'action des professionnels pour les biens et services fournis aux consommateurs, contre 5 ans entre professionnels. Le délai court depuis l'échéance de la facture : avec un particulier, la fenêtre d'action est courte et les relances ne l'allongent pas.",
  },
  {
    q: "Un devis signé est-il obligatoire pour me faire payer par un particulier ?",
    r: "Au-delà de 1 500 €, la preuve d'un contrat contre un particulier exige en principe un écrit (article 1359 du Code civil) : le devis signé est votre pièce maîtresse. En dessous, la preuve est libre, mais un début d'exécution acceptée sans écrit reste plus difficile à établir. Par ailleurs, un devis préalable est réglementairement obligatoire pour la plupart des travaux de bâtiment et de dépannage au-delà de 150 €.",
  },
  {
    q: "Quel tribunal pour une injonction de payer contre un particulier ?",
    r: "Le tribunal judiciaire du domicile du débiteur (et non le tribunal de commerce). La requête en injonction de payer y est gratuite et se dépose sans avocat, avec le formulaire dédié et vos justificatifs.",
  },
  {
    q: "Le particulier qui ne répond pas peut-il être saisi ?",
    r: "Oui, mais uniquement après obtention d'un titre exécutoire (injonction de payer non contestée, jugement, ou accord homologué). Un commissaire de justice peut alors saisir comptes ou biens, dans les limites protectrices propres aux particuliers (solde bancaire insaisissable, biens nécessaires à la vie courante).",
  },
];

export default function Page() {
  return (
    <GuideShell title={TITLE} updated={UPDATED}>
      {guideJsonLd({
        slug: "facture-impayee-client-particulier",
        title: TITLE,
        description: DESCRIPTION,
        updated: "2026-07-05",
        faq: FAQ,
      }).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}

      <p>
        <strong>Quand le client qui ne paie pas est un particulier, le
        recouvrement obéit à des règles différentes du B2B : prescription
        raccourcie à 2 ans, pas d’indemnité forfaitaire de 40 €, intérêts
        seulement à compter de la mise en demeure, et exigence d’un écrit
        pour prouver le contrat au-delà de 1 500 €.</strong> Pour un
        artisan ou un indépendant qui travaille avec des particuliers,
        ignorer ces différences mène à des relances mal fondées ou à des
        créances prescrites. Voici ce qui change, point par point.
      </p>

      <h2>B2B et B2C : le tableau des différences</h2>
      <table>
        <thead>
          <tr>
            <th>Règle</th>
            <th>Client professionnel</th>
            <th>Client particulier</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Prescription</td>
            <td>5 ans</td>
            <td><strong>2 ans</strong></td>
          </tr>
          <tr>
            <td>Indemnité de 40 €</td>
            <td>Due de plein droit</td>
            <td><strong>Non applicable</strong></td>
          </tr>
          <tr>
            <td>Intérêts de retard</td>
            <td>De plein droit dès l’échéance</td>
            <td>Au taux légal, après mise en demeure</td>
          </tr>
          <tr>
            <td>Preuve du contrat</td>
            <td>Libre entre commerçants</td>
            <td>Écrit exigé au-delà de 1 500 €</td>
          </tr>
          <tr>
            <td>Tribunal (injonction de payer)</td>
            <td>Tribunal de commerce (~35 €)</td>
            <td>Tribunal judiciaire (gratuit)</td>
          </tr>
        </tbody>
      </table>

      <h2>La mise en demeure devient centrale</h2>
      <p>
        Entre professionnels, les intérêts courent tout seuls ; face à un
        particulier, c’est <strong>la mise en demeure qui les
        déclenche</strong> (article 1344-1 du Code civil). Elle marque
        aussi le sérieux de la démarche avant tout recours. Mentions,
        envoi en recommandé, effets : notre guide{" "}
        <Link href="/guides/mise-en-demeure-de-payer">
          Mise en demeure de payer
        </Link>{" "}
        s’applique intégralement, en retirant simplement l’indemnité de
        40 € du chiffrage.
      </p>

      <h2>Le calendrier adapté au délai de 2 ans</h2>
      <ul>
        <li>
          <strong>Relance cordiale immédiate</strong> : mêmes réflexes qu’en
          B2B — écrit, montant, échéance, moyen de payer (voir{" "}
          <Link href="/guides/relance-facture-impayee">la méthode</Link>).
        </li>
        <li>
          <strong>Mise en demeure sans traîner</strong> : avec 2 ans de
          fenêtre totale, la phase amiable ne doit pas dépasser quelques
          semaines.
        </li>
        <li>
          <strong>Recours</strong> : injonction de payer au tribunal
          judiciaire (gratuite), ou{" "}
          <Link href="/guides/recouvrement-creance-moins-5000-euros">
            procédure simplifiée
          </Link>{" "}
          par commissaire de justice sous 5 000 € si le client est de bonne
          foi.
        </li>
        <li>
          <strong>Surveiller la{" "}
          <Link href="/guides/prescription-facture-impayee">
            prescription
          </Link></strong>{" "}
          : seule une action en justice ou une reconnaissance écrite du
          client (email, échéancier demandé, paiement partiel) fait
          repartir le délai.
        </li>
      </ul>

      <h2>Se protéger en amont : les réflexes qui évitent l’impayé</h2>
      <ul>
        <li>
          <strong>Devis signé systématique</strong>, même pour de petits
          montants : c’est votre preuve du contrat, et il est de toute
          façon obligatoire pour la plupart des travaux au-delà de 150 €.
          Sa valeur exacte :{" "}
          <Link href="/guides/devis-signe-valeur-juridique">
            Devis signé, quelle valeur juridique
          </Link>
          .
        </li>
        <li>
          <strong>Acompte à la commande</strong> : il teste la solvabilité
          et réduit l’exposition.
        </li>
        <li>
          <strong>Solde à la réception</strong>, pas « quand ça
          s’arrangera » : une date d’échéance écrite sur la facture fait
          courir les délais sans ambiguïté.
        </li>
        <li>
          <strong>Traces écrites des accords en cours de chantier</strong> :
          un SMS de confirmation vaut mieux qu’un accord verbal — voir{" "}
          <Link href="/guides/preuves-impaye-litige">
            quelles preuves comptent
          </Link>
          .
        </li>
      </ul>

      <GuideFaq items={FAQ} />
    </GuideShell>
  );
}
