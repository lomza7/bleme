import type { Metadata } from "next";
import Link from "next/link";
import { GuideFaq, GuideShell, guideJsonLd } from "@/components/guides/guide-shell";
import { JsonLd } from "@/components/seo/json-ld";

const TITLE = "Mise en demeure de payer : mentions, envoi, effets";
const DESCRIPTION =
  "La mise en demeure de payer est le courrier formel qui exige le règlement d'une facture sous un délai précis. Mentions obligatoires, envoi en recommandé, effets juridiques (intérêts de retard, préalable au procès) : le guide pratique.";
const UPDATED = "5 juillet 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/mise-en-demeure-de-payer" },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  {
    q: "Puis-je envoyer une mise en demeure moi-même, sans avocat ?",
    r: "Oui. Tout créancier peut mettre en demeure son débiteur : aucune loi ne réserve cet acte aux avocats ou aux commissaires de justice. Un courrier signé de l'entreprise créancière, envoyé en recommandé avec accusé de réception, produit pleinement ses effets juridiques.",
  },
  {
    q: "La mise en demeure doit-elle obligatoirement partir en recommandé ?",
    r: "L'article 1344 du Code civil exige une « sommation ou un acte portant interpellation suffisante ». En pratique, le recommandé avec accusé de réception s'impose : il date le courrier et prouve sa réception, deux points systématiquement vérifiés par le juge.",
  },
  {
    q: "Quel délai de paiement indiquer dans la mise en demeure ?",
    r: "Aucun délai légal n'est imposé : 8 jours est l'usage courant, 15 jours pour rester conciliant. L'important est d'indiquer un délai précis et raisonnable, à compter de la réception du courrier.",
  },
  {
    q: "Que se passe-t-il si le débiteur ignore la mise en demeure ?",
    r: "Le silence après mise en demeure ouvre la voie aux recours : injonction de payer au tribunal de commerce, procédure simplifiée par commissaire de justice (créances < 5 000 €) ou assignation avec un avocat. La mise en demeure restée sans réponse devient une pièce maîtresse du dossier.",
  },
  {
    q: "Une mise en demeure interrompt-elle la prescription ?",
    r: "Non, c'est un point souvent mal compris : une simple mise en demeure ne suspend ni n'interrompt le délai de prescription de 5 ans. Seuls une action en justice, un acte d'exécution forcée ou une reconnaissance de dette par le débiteur l'interrompent.",
  },
];

export default function Page() {
  return (
    <GuideShell title={TITLE} updated={UPDATED}>
      {guideJsonLd({
        slug: "mise-en-demeure-de-payer",
        title: TITLE,
        description: DESCRIPTION,
        updated: "2026-07-05",
        faq: FAQ,
      }).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}

      <p>
        <strong>La mise en demeure de payer est le courrier formel par lequel
        un créancier exige de son débiteur le règlement d’une somme due, sous
        un délai précis, avant d’engager des poursuites.</strong> Prévue aux
        articles 1344 et suivants du Code civil, elle marque la fin de la
        phase amiable : elle fait courir les intérêts de retard et constitue
        le préalable attendu par les tribunaux. Bien rédigée, elle suffit
        souvent à débloquer le paiement — le débiteur comprend que le dossier
        est tenu.
      </p>

      <h2>Les mentions indispensables</h2>
      <ul>
        <li>
          <strong>La mention « mise en demeure »</strong> en objet ou dans le
          corps : le courrier doit être une « interpellation suffisante »,
          sans ambiguïté sur son caractère formel.
        </li>
        <li>
          <strong>L’identité complète des deux parties</strong> :
          dénomination, adresse, SIRET du créancier et du débiteur.
        </li>
        <li>
          <strong>Le fondement de la créance</strong> : numéro et date de la
          facture, prestation ou livraison concernée, date d’échéance
          dépassée.
        </li>
        <li>
          <strong>Le montant exigé, détaillé</strong> : principal, indemnité
          forfaitaire de recouvrement de 40 € par facture (
          <Link href="/guides/indemnite-forfaitaire-40-euros">
            entre professionnels
          </Link>
          ), intérêts de retard.
        </li>
        <li>
          <strong>Un délai de paiement précis</strong> : 8 jours est l’usage,
          à compter de la réception.
        </li>
        <li>
          <strong>La réserve d’action</strong> : « à défaut, nous nous
          réservons le droit d’engager toute action utile au recouvrement ».
        </li>
        <li>
          <strong>Date et signature</strong> du créancier.
        </li>
      </ul>

      <h2>L’envoi : le recommandé n’est pas un détail</h2>
      <p>
        Le recommandé avec accusé de réception fait deux choses qu’aucun
        email ne fait : il <strong>date officiellement</strong> la mise en
        demeure et <strong>prouve sa réception</strong> (ou son refus, qui
        produit les mêmes effets). Conservez le bordereau de dépôt et
        l’accusé : ce sont des pièces du dossier. La lettre recommandée
        électronique qualifiée (LRE) a la même valeur légale que le
        recommandé papier (article L100 du Code des postes et communications
        électroniques).
      </p>

      <h2>Les effets juridiques</h2>
      <ul>
        <li>
          <strong>Les intérêts moratoires courent</strong> à compter de la
          mise en demeure (article 1344-1 du Code civil) — entre
          professionnels, ils courent même de plein droit dès l’échéance.
        </li>
        <li>
          <strong>Le préalable au procès est constitué</strong> : les juges
          vérifient qu’une tentative amiable sérieuse a eu lieu avant
          l’action.
        </li>
        <li>
          <strong>Le rapport de force change</strong> : le débiteur sait
          désormais que l’inaction a un coût, et que le créancier documente.
        </li>
      </ul>

      <h2>Après la mise en demeure : le calendrier</h2>
      <p>
        Passé le délai fixé sans paiement ni réponse sérieuse, trois voies
        s’ouvrent, détaillées dans notre guide{" "}
        <Link href="/guides/facture-impayee-que-faire">
          Facture impayée : que faire
        </Link>{" "}
        : l’injonction de payer (rapide, ~35 €, sans avocat), la procédure
        simplifiée par commissaire de justice pour les créances de moins de
        5 000 €, ou l’assignation avec un avocat pour les dossiers contestés.
        Dans tous les cas, un dossier ordonné — facture, devis signé,
        échanges, relances datées, mise en demeure et son accusé — fait
        gagner du temps et des honoraires.
      </p>

      <GuideFaq items={FAQ} />
    </GuideShell>
  );
}
