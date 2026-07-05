import type { Metadata } from "next";
import Link from "next/link";
import { GuideFaq, GuideShell, guideJsonLd } from "@/components/guides/guide-shell";
import { JsonLd } from "@/components/seo/json-ld";

const TITLE = "Client qui conteste vos travaux ou votre facture : que faire";
const DESCRIPTION =
  "Quand un client conteste la facture au lieu de la payer, l'impayé devient un litige : il se traite par écrit, point par point, preuves à l'appui. Répondre sans s'énerver, réclamer la partie non contestée, documenter la réception des travaux : la méthode complète.";
const UPDATED = "5 juillet 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/client-conteste-travaux-facture" },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  {
    q: "Le client peut-il retenir la totalité du paiement pour un défaut mineur ?",
    r: "Non. L'exception d'inexécution (article 1219 du Code civil) autorise à suspendre le paiement seulement si l'inexécution est suffisamment grave, et la jurisprudence exige une forme de proportionnalité : un joint de carrelage à reprendre ne justifie pas de bloquer 15 000 € de chantier. Rappelez ce principe par écrit et réclamez au moins la partie non contestée.",
  },
  {
    q: "Le client n'a émis aucune réserve à la réception : peut-il encore contester ?",
    r: "Pour les défauts apparents, la réception sans réserve joue en votre faveur : elle couvre en principe les vices et défauts de conformité apparents. Le client conserve en revanche ses recours pour les désordres cachés ou relevant des garanties légales. D'où l'importance d'un procès-verbal de réception signé, même sommaire.",
  },
  {
    q: "Dois-je répondre à une contestation que je juge de mauvaise foi ?",
    r: "Oui, toujours, et par écrit. Un silence se lit comme un aveu, et devant un juge, le créancier qui a répondu point par point avec des pièces incarne le professionnel sérieux. Une réponse factuelle et datée est aussi ce qui permet ensuite d'envoyer une mise en demeure crédible sur la partie due.",
  },
  {
    q: "Puis-je quand même envoyer une mise en demeure si une partie est contestée ?",
    r: "Oui, au minimum sur la partie non contestée de la facture, en prenant acte par écrit du point de désaccord restant. Mettre en demeure sur la totalité reste possible si la contestation est infondée, mais attendez-vous à ce que le litige soit tranché par un juge si le client maintient sa position.",
  },
  {
    q: "À quel moment faire appel à une expertise ou à un tiers ?",
    r: "Quand le désaccord technique persiste malgré les échanges écrits : une expertise amiable (contradictoire, chacun invité) objective l'état des travaux à coût maîtrisé. Le conciliateur de justice, gratuit, est aussi une étape utile — et une médiation formelle suspend la prescription pendant la négociation.",
  },
];

export default function Page() {
  return (
    <GuideShell title={TITLE} updated={UPDATED}>
      {guideJsonLd({
        slug: "client-conteste-travaux-facture",
        title: TITLE,
        description: DESCRIPTION,
        updated: "2026-07-05",
        faq: FAQ,
      }).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}

      <p>
        <strong>Quand un client conteste la facture au lieu de la payer,
        vous ne gérez plus un simple impayé mais un litige : le traitement
        change, et la pire réponse est l’absence de réponse.</strong> Un
        litige se gagne sur pièces : chronologie reconstituée, réponse
        écrite point par point, distinction entre ce qui est contesté et ce
        qui ne l’est pas. Bien mené, il se règle le plus souvent sans juge ;
        mal mené, il transforme une créance solide en dossier fragile.
      </p>

      <h2>Première réponse : les bons réflexes sous 48 h</h2>
      <ul>
        <li>
          <strong>Accuser réception par écrit</strong>, sans polémique :
          « Nous avons bien noté vos remarques du 12 juin, voici nos
          réponses. »
        </li>
        <li>
          <strong>Faire préciser la contestation</strong> : « qualité
          insuffisante » ne veut rien dire ; demandez quels postes, quels
          défauts, quelles pièces. Une contestation qui refuse de se
          préciser se décrédibilise.
        </li>
        <li>
          <strong>Geler le ton</strong> : chaque mot écrit peut se retrouver
          devant un juge. Factuel, daté, professionnel.
        </li>
        <li>
          <strong>Rassembler le dossier</strong> :{" "}
          <Link href="/guides/devis-signe-valeur-juridique">devis signé</Link>
          , échanges, photos avant/après, bons de livraison, PV de
          réception.
        </li>
      </ul>

      <h2>Répondre point par point, preuve à l’appui</h2>
      <p>
        La méthode qui fait la différence : reprendre chaque grief dans
        l’ordre, et lui opposer un fait daté et sa pièce. « Vous indiquez
        que la pose n’était pas terminée au 15 mai — le procès-verbal de
        réception signé le 12 mai (pièce 3) mentionne l’achèvement sans
        réserve. Vous évoquez un carrelage non conforme — la référence
        posée est celle du devis signé (pièce 1, poste 4). » Ce format,
        c’est exactement ce qu’un juge attendra plus tard ; le produire dès
        la phase amiable montre que le rapport de force est déjà documenté.
        Sur la valeur de vos messages et photos :{" "}
        <Link href="/guides/preuves-impaye-litige">
          quelles preuves comptent vraiment
        </Link>
        .
      </p>

      <h2>Le levier souvent oublié : la partie non contestée</h2>
      <p>
        Un client conteste rarement 100 % d’une facture. Isolez par écrit
        ce qui n’est pas discuté et exigez son paiement immédiat : le
        client qui refuse de régler même la partie incontestée révèle que
        la contestation n’est qu’un prétexte de trésorerie — et votre{" "}
        <Link href="/guides/mise-en-demeure-de-payer">mise en demeure</Link>{" "}
        sur cette partie devient inattaquable. L’
        <Link href="/guides/injonction-de-payer">injonction de payer</Link>{" "}
        reste envisageable sur ce périmètre en cas de silence prolongé.
      </p>

      <h2>Si le désaccord persiste : l’escalade maîtrisée</h2>
      <table>
        <thead>
          <tr>
            <th>Étape</th>
            <th>Outil</th>
            <th>Intérêt</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Désaccord technique</td>
            <td>Expertise amiable contradictoire</td>
            <td>Objective l’état des travaux, pièce forte au dossier</td>
          </tr>
          <tr>
            <td>Blocage relationnel</td>
            <td>Conciliateur de justice (gratuit) ou médiation</td>
            <td>Solution négociée ; la médiation suspend la prescription</td>
          </tr>
          <tr>
            <td>Mauvaise foi persistante</td>
            <td>Mise en demeure puis action judiciaire</td>
            <td>
              Le dossier constitué en amiable sert tel quel devant le juge
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Et pendant tout ce temps, gardez un œil sur la{" "}
        <Link href="/guides/prescription-facture-impayee">prescription</Link>{" "}
        : les discussions informelles ne l’arrêtent pas.
      </p>

      <GuideFaq items={FAQ} />
    </GuideShell>
  );
}
