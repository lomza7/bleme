import type { Metadata } from "next";
import Link from "next/link";
import { GuideFaq, GuideShell, guideJsonLd } from "@/components/guides/guide-shell";
import { JsonLd } from "@/components/seo/json-ld";

const TITLE = "Délais de paiement entre professionnels : 30, 45 ou 60 jours";
const DESCRIPTION =
  "Entre professionnels, le délai de paiement par défaut est de 30 jours après réception de la marchandise ou exécution de la prestation ; un délai convenu ne peut dépasser 60 jours date de facture, ou 45 jours fin de mois (article L441-10 du Code de commerce). Plafonds, cas particuliers et sanctions DGCCRF.";
const UPDATED = "5 juillet 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/delais-de-paiement-entre-professionnels" },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  {
    q: "Mon client peut-il m'imposer un paiement à 90 jours ?",
    r: "Non. Le plafond légal est de 60 jours à compter de la date d'émission de la facture (ou 45 jours fin de mois si le contrat le prévoit). Toute clause qui dépasse ces plafonds est nulle et expose le client à une amende administrative de la DGCCRF pouvant atteindre 2 millions d'euros.",
  },
  {
    q: "Que signifie exactement « 45 jours fin de mois » ?",
    r: "Deux lectures sont admises : 45 jours après l'émission de la facture puis jusqu'à la fin de ce mois, ou fin du mois d'émission puis 45 jours. Le contrat doit préciser la méthode retenue ; à défaut, l'ambiguïté profite généralement à l'interprétation la plus courte pour le créancier qui la revendique de bonne foi.",
  },
  {
    q: "Puis-je exiger un paiement comptant ou à réception ?",
    r: "Oui. Les plafonds légaux sont des maximums, pas des standards : rien n'interdit de prévoir un paiement à la commande, à réception de facture ou à 15 jours. Pour les petites structures, raccourcir le délai contractuel est le premier levier anti-impayés.",
  },
  {
    q: "Quel est le délai si le contrat ne prévoit rien ?",
    r: "30 jours suivant la réception des marchandises ou l'exécution de la prestation : c'est le délai supplétif de l'article L441-10. Passé ce délai, le client est en retard, les pénalités et l'indemnité de 40 € courent de plein droit.",
  },
  {
    q: "Qui contrôle et sanctionne les retards de paiement ?",
    r: "La DGCCRF contrôle les délais de paiement et prononce des amendes administratives (jusqu'à 2 millions d'euros pour une société, doublées en cas de récidive), systématiquement publiées en ligne : le « name and shame » fait partie de la sanction. Cela ne remplace pas votre recouvrement : les sanctions vont à l'État, pas au créancier.",
  },
];

export default function Page() {
  return (
    <GuideShell title={TITLE} updated={UPDATED}>
      {guideJsonLd({
        slug: "delais-de-paiement-entre-professionnels",
        title: TITLE,
        description: DESCRIPTION,
        updated: "2026-07-05",
        faq: FAQ,
      }).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}

      <p>
        <strong>Entre professionnels, le délai de paiement par défaut est de
        30 jours après réception de la marchandise ou exécution de la
        prestation ; les parties peuvent convenir d’un délai plus long, dans
        la limite de 60 jours à compter de la date de facture, ou 45 jours
        fin de mois</strong> (article L441-10 du Code de commerce). Ces
        plafonds sont d’ordre public : aucune clause, aucun rapport de
        force commercial ne permet de les dépasser. Connaître ces règles,
        c’est savoir exactement quand une facture devient un impayé — et
        quand vos droits s’ouvrent.
      </p>

      <h2>Les trois régimes à connaître</h2>
      <table>
        <thead>
          <tr>
            <th>Situation</th>
            <th>Délai maximum</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Rien n’est prévu au contrat</td>
            <td>30 jours après réception ou exécution</td>
          </tr>
          <tr>
            <td>Délai convenu entre les parties</td>
            <td>60 jours date de facture</td>
          </tr>
          <tr>
            <td>Variante « fin de mois » prévue au contrat</td>
            <td>45 jours fin de mois</td>
          </tr>
          <tr>
            <td>Factures périodiques (récapitulatives)</td>
            <td>45 jours après émission</td>
          </tr>
        </tbody>
      </table>
      <p>
        Des régimes sectoriels dérogent à ces plafonds (transport routier à
        30 jours, denrées périssables plus courts encore) : vérifiez votre
        secteur si vous êtes concerné.
      </p>

      <h2>Ce qui se passe le jour du dépassement</h2>
      <p>
        Dès le lendemain de l’échéance, sans aucune formalité :
      </p>
      <ul>
        <li>
          les{" "}
          <Link href="/guides/penalites-de-retard">pénalités de retard</Link>{" "}
          commencent à courir, de plein droit ;
        </li>
        <li>
          l’
          <Link href="/guides/indemnite-forfaitaire-40-euros">
            indemnité forfaitaire de 40 €
          </Link>{" "}
          est due, par facture en retard ;
        </li>
        <li>
          le délai de{" "}
          <Link href="/guides/prescription-facture-impayee">prescription</Link>{" "}
          de 5 ans commence à s’écouler ;
        </li>
        <li>
          votre calendrier de{" "}
          <Link href="/guides/relance-facture-impayee">relance</Link> peut
          démarrer immédiatement : attendre « par politesse » n’apporte
          rien.
        </li>
      </ul>

      <h2>Négocier ses délais : les leviers du petit fournisseur</h2>
      <ul>
        <li>
          <strong>Écrire le délai sur le devis et la facture</strong> : un
          délai non écrit devient une discussion ; un délai écrit devient
          une échéance.
        </li>
        <li>
          <strong>Demander un acompte</strong> : 30 % à la commande réduit
          l’exposition et teste la solvabilité du client dès le départ.
        </li>
        <li>
          <strong>Facturer vite</strong> : le délai court depuis l’émission
          (ou la réception de la prestation). Chaque semaine entre la fin du
          chantier et l’envoi de la facture est un crédit gratuit consenti
          au client.
        </li>
        <li>
          <strong>Éviter le « 45 jours fin de mois » ambigu</strong> : si
          votre client l’impose, faites préciser la méthode de calcul au
          contrat.
        </li>
      </ul>

      <h2>Les sanctions contre les mauvais payeurs</h2>
      <p>
        Le dépassement des plafonds légaux expose le débiteur à une{" "}
        <strong>amende administrative de la DGCCRF</strong> : jusqu’à
        75 000 € pour une personne physique et 2 millions d’euros pour une
        société, doublés en cas de récidive dans les deux ans, avec
        publication systématique de la sanction. Ces amendes assainissent
        les pratiques mais ne remboursent pas le créancier : pour récupérer
        votre argent, la voie reste la relance, la{" "}
        <Link href="/guides/mise-en-demeure-de-payer">mise en demeure</Link>{" "}
        puis, si nécessaire, l’
        <Link href="/guides/injonction-de-payer">injonction de payer</Link>.
      </p>

      <GuideFaq items={FAQ} />
    </GuideShell>
  );
}
