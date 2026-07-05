import type { Metadata } from "next";
import Link from "next/link";
import { GuideFaq, GuideShell, guideJsonLd } from "@/components/guides/guide-shell";
import { JsonLd } from "@/components/seo/json-ld";

const TITLE = "Créance de moins de 5 000 € : la procédure simplifiée de recouvrement";
const DESCRIPTION =
  "La procédure simplifiée de recouvrement (article L125-1 du Code des procédures civiles d'exécution) permet d'obtenir un titre exécutoire par commissaire de justice, sans juge, pour toute créance contractuelle inférieure à 5 000 €. Conditions, déroulement en 3 étapes, coût et limites.";
const UPDATED = "5 juillet 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/recouvrement-creance-moins-5000-euros" },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  {
    q: "Le débiteur peut-il simplement ignorer la procédure simplifiée ?",
    r: "Oui, et c'est sa principale limite : sans réponse du débiteur dans le délai d'un mois, la procédure échoue et il faut basculer vers l'injonction de payer. Elle fonctionne bien face aux débiteurs de bonne foi qui reconnaissent la dette mais traînent ; mal face à ceux qui font le mort.",
  },
  {
    q: "Combien coûte la procédure simplifiée ?",
    r: "Les frais sont réglementés et restent à la charge du créancier : quelques dizaines d'euros pour l'invitation initiale, puis des émoluments proportionnels en cas de succès. Le total reste généralement inférieur à une procédure judiciaire complète, mais contrairement à l'injonction de payer, ces frais ne peuvent pas être mis à la charge du débiteur.",
  },
  {
    q: "Quelles créances sont éligibles ?",
    r: "Toute créance contractuelle (facture issue d'un devis, d'un contrat, d'un abonnement) ou résultant d'une obligation statutaire, dont le montant, intérêts compris, ne dépasse pas 5 000 €. Le débiteur peut être un professionnel ou un particulier.",
  },
  {
    q: "Quelle valeur a le titre délivré par le commissaire de justice ?",
    r: "La même force qu'un jugement pour l'exécution : c'est un titre exécutoire qui permet de pratiquer des saisies. La différence est qu'il constate un accord entre créancier et débiteur sur le montant et les modalités, plutôt qu'une condamnation.",
  },
  {
    q: "Puis-je lancer la procédure moi-même ?",
    r: "Oui : la demande se fait directement auprès d'un commissaire de justice du ressort de la cour d'appel où réside le débiteur, ou en ligne sur la plateforme dédiée de la profession. Il vous faut les pièces habituelles : facture, contrat ou devis, et idéalement une mise en demeure restée sans effet.",
  },
];

export default function Page() {
  return (
    <GuideShell title={TITLE} updated={UPDATED}>
      {guideJsonLd({
        slug: "recouvrement-creance-moins-5000-euros",
        title: TITLE,
        description: DESCRIPTION,
        updated: "2026-07-05",
        faq: FAQ,
      }).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}

      <p>
        <strong>La procédure simplifiée de recouvrement des petites créances
        permet d’obtenir un titre exécutoire délivré par un commissaire de
        justice, sans passer devant un juge, pour toute créance
        contractuelle inférieure à 5 000 €</strong> (article L125-1 du Code
        des procédures civiles d’exécution). Créée pour désengorger les
        tribunaux des petits impayés, elle repose sur un mécanisme d’accord :
        le commissaire de justice invite le débiteur à reconnaître la dette
        et à convenir des modalités de paiement. Rapide et peu coûteuse
        quand le débiteur joue le jeu, inopérante quand il se tait.
      </p>

      <h2>Les trois étapes</h2>
      <table>
        <thead>
          <tr>
            <th>Étape</th>
            <th>Ce qui se passe</th>
            <th>Délai</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1. Invitation</td>
            <td>
              Le commissaire de justice envoie au débiteur une lettre
              recommandée l’invitant à participer à la procédure
            </td>
            <td>Départ de la procédure</td>
          </tr>
          <tr>
            <td>2. Réponse du débiteur</td>
            <td>
              Il accepte (et discute montant et échéancier) ou refuse ; le
              silence vaut refus
            </td>
            <td>1 mois</td>
          </tr>
          <tr>
            <td>3. Titre exécutoire</td>
            <td>
              En cas d’accord, le commissaire de justice délivre un titre
              qui permet l’exécution forcée si l’échéancier n’est pas tenu
            </td>
            <td>Dans la foulée de l’accord</td>
          </tr>
        </tbody>
      </table>

      <h2>Quand la choisir, quand l’éviter</h2>
      <ul>
        <li>
          <strong>Bon cas</strong> : le client reconnaît devoir la somme,
          promet, repousse — un accord cadré avec titre exécutoire à la clé
          transforme ses promesses en engagement contraignant.
        </li>
        <li>
          <strong>Bon cas</strong> : vous voulez préserver la relation
          commerciale — la démarche est moins frontale qu’une assignation,
          et l’échéancier négocié est son cœur.
        </li>
        <li>
          <strong>Mauvais cas</strong> : le débiteur ne répond à rien depuis
          des semaines. Son silence enterre la procédure ; l’
          <Link href="/guides/injonction-de-payer">injonction de payer</Link>
          , qui aboutit sans lui, est alors la bonne voie.
        </li>
        <li>
          <strong>Mauvais cas</strong> : la créance est{" "}
          <Link href="/guides/client-conteste-travaux-facture">
            sérieusement contestée
          </Link>{" "}
          — aucun accord n’émergera, traitez le litige d’abord.
        </li>
      </ul>

      <h2>Avant de lancer : le dossier qui maximise l’accord</h2>
      <p>
        Le débiteur accepte d’autant plus volontiers que la dette est
        indiscutable. Arrivez avec la facture, le devis signé, la preuve
        d’exécution et une{" "}
        <Link href="/guides/mise-en-demeure-de-payer">mise en demeure</Link>{" "}
        restée sans réponse : l’invitation du commissaire de justice n’est
        alors que la suite logique d’un dossier déjà solide. Pensez aussi à
        chiffrer{" "}
        <Link href="/guides/penalites-de-retard">pénalités</Link> et{" "}
        <Link href="/guides/indemnite-forfaitaire-40-euros">
          indemnité de 40 €
        </Link>{" "}
        dans le montant réclamé, tant que le total reste sous 5 000 €.
      </p>

      <h2>Un point de vigilance : la prescription</h2>
      <p>
        La procédure ne dispense pas de surveiller les délais : la{" "}
        <Link href="/guides/prescription-facture-impayee">prescription</Link>{" "}
        de la créance continue de courir tant qu’aucun accord n’est trouvé
        ni aucune action en justice engagée. Si le débiteur laisse passer le
        mois sans répondre et que l’échéance de prescription approche, ne
        perdez pas de temps : basculez immédiatement sur l’injonction de
        payer.
      </p>

      <GuideFaq items={FAQ} />
    </GuideShell>
  );
}
