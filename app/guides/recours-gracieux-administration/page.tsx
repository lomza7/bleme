import type { Metadata } from "next";
import Link from "next/link";
import { GuideFaq, GuideShell, guideJsonLd } from "@/components/guides/guide-shell";
import { JsonLd } from "@/components/seo/json-ld";

const TITLE = "Recours gracieux : contester une décision de l'administration";
const DESCRIPTION =
  "Le recours gracieux demande à l'administration de revoir sa propre décision, avant tout tribunal. À qui l'adresser, quelles mentions, le délai de 2 mois, ce que vaut le silence et la suite devant le tribunal administratif : le guide pratique.";
const UPDATED = "9 juillet 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/recours-gracieux-administration" },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  {
    q: "Recours gracieux ou recours hiérarchique : lequel choisir ?",
    r: "Le recours gracieux s'adresse à l'autorité qui a pris la décision ; le recours hiérarchique, à son supérieur (le ministre pour un service ministériel, le préfet pour certains services locaux). Les deux sont possibles, séparément ou successivement. Le gracieux est l'usage le plus courant en première intention : c'est le service qui connaît le dossier.",
  },
  {
    q: "Le recours gracieux est-il obligatoire avant le tribunal administratif ?",
    r: "En principe non : il est facultatif (certaines matières imposent un recours administratif préalable obligatoire — « RAPO » —, la décision contestée le mentionne alors). Mais il est souvent judicieux : gratuit, rapide à former, il interrompt le délai de recours contentieux (article L411-2 du Code des relations entre le public et l'administration) et règle une partie des dossiers sans juge.",
  },
  {
    q: "Combien de temps l'administration a-t-elle pour répondre ?",
    r: "Le silence gardé pendant deux mois sur un recours administratif vaut, en règle générale, décision implicite de rejet (article R421-2 du Code de justice administrative). Ce rejet implicite fait courir un nouveau délai de deux mois pour saisir le tribunal administratif.",
  },
  {
    q: "Faut-il envoyer le recours en recommandé ?",
    r: "Ce n'est pas une condition de validité, mais c'est l'usage prudent : le recommandé avec accusé de réception date votre demande — ce qui compte pour l'interruption du délai — et prouve sa réception. Beaucoup d'administrations proposent aussi une téléprocédure ; conservez alors l'accusé électronique.",
  },
  {
    q: "Quel tribunal administratif saisir en cas de rejet ?",
    r: "En règle générale, celui dans le ressort duquel siège l'autorité qui a pris la décision ; pour de nombreuses décisions individuelles (police administrative, permis de conduire, fonctionnaires…), c'est le tribunal de votre lieu de résidence (articles R312-1 et suivants du Code de justice administrative). La saisine se fait en ligne via Télérecours citoyens, dans le délai de deux mois.",
  },
  {
    q: "BLEME peut-il rédiger le recours à ma place ?",
    r: "BLEME prépare un brouillon motivé à partir de votre récit et de vos pièces, avec des références vérifiées sur les sources officielles — puis vous relisez, corrigez et validez avant tout envoi. Ce n'est pas un conseil juridique personnalisé : en cas de doute ou d'enjeu important, faites valider le dossier par un avocat.",
  },
];

export default function Page() {
  return (
    <GuideShell title={TITLE} updated={UPDATED}>
      {guideJsonLd({
        slug: "recours-gracieux-administration",
        title: TITLE,
        description: DESCRIPTION,
        updated: "2026-07-09",
        faq: FAQ,
      }).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}

      <p>
        <strong>Le recours gracieux est le courrier par lequel vous demandez à
        une administration de revenir sur sa propre décision</strong> — refus,
        amende, retrait de droits, inscription erronée dans un fichier — avant
        d’envisager le tribunal. Prévu par le Code des relations entre le
        public et l’administration (article L410-1), il est gratuit, sans
        avocat, et il produit un effet précieux : formé dans le délai de
        recours contentieux, il <strong>interrompt ce délai</strong>, qui ne
        recommence à courir qu’à partir de la réponse de l’administration
        (article L411-2 du même code).
      </p>

      <h2>À qui écrire</h2>
      <ul>
        <li>
          <strong>Recours gracieux</strong> : à l’autorité qui a pris la
          décision — le service des impôts, la préfecture, la mairie, le
          bureau national compétent. C’est elle qui connaît le dossier et peut
          le corriger le plus vite.
        </li>
        <li>
          <strong>Recours hiérarchique</strong> : au supérieur de cette
          autorité (le ministre, le préfet). Utile quand le service maintient
          sa position ou ne répond pas.
        </li>
        <li>
          <strong>Attention à la bonne porte</strong> : depuis les
          réorganisations de l’État, certaines compétences sont centralisées.
          Exemple typique : pour le permis à points, la préfecture renvoie
          désormais vers le Bureau national des droits à conduire (ministère
          de l’Intérieur). La décision contestée mentionne en principe
          l’autorité et les voies de recours — lisez ce paragraphe en premier.
        </li>
      </ul>

      <h2>Les mentions qui font un recours sérieux</h2>
      <ul>
        <li>
          <strong>Votre identification complète</strong> : nom, adresse,
          références de dossier (numéro d’avis, de permis, d’allocataire…).
        </li>
        <li>
          <strong>La décision visée</strong> : autorité, date de notification,
          référence exacte. Joignez-en la copie.
        </li>
        <li>
          <strong>Les faits, datés et dans l’ordre</strong> : ce qui s’est
          passé, sans commentaire superflu.
        </li>
        <li>
          <strong>Une demande expresse</strong> : réexamen, annulation,
          rectification, restitution — dites précisément ce que vous demandez.
        </li>
        <li>
          <strong>Les pièces justificatives, numérotées</strong> : jugement,
          dépôt de plainte, attestations, factures. Une pièce citée dans le
          texte doit se retrouver dans la liste.
        </li>
        <li>
          <strong>La mention des suites envisagées</strong>, factuelle : à
          défaut de réponse dans le délai, vous saisirez le tribunal
          administratif compétent.
        </li>
      </ul>

      <h2>L’envoi et la preuve</h2>
      <p>
        Envoyez le recours en <strong>recommandé avec accusé de
        réception</strong> (ou via la téléprocédure officielle quand elle
        existe) et conservez le bordereau et l’accusé : la date de réception
        fait courir le délai de réponse de l’administration et prouve
        l’interruption du délai contentieux. Gardez une copie exacte du
        courrier envoyé — en cas de contentieux, c’est une pièce du dossier.
      </p>

      <h2>Le silence de l’administration a un sens</h2>
      <p>
        Passé <strong>deux mois</strong> sans réponse, le silence vaut en
        règle générale <strong>décision implicite de rejet</strong> (article
        R421-2 du Code de justice administrative). Ce n’est pas une impasse :
        ce rejet implicite ouvre un nouveau délai de deux mois pour saisir le
        tribunal administratif (article R421-1 du même code). D’où
        l’importance de dater précisément votre envoi — et de vous rappeler
        l’échéance.
      </p>

      <h2>Après le rejet : le tribunal administratif</h2>
      <p>
        Si l’administration rejette (explicitement ou par silence), le recours
        contentieux se forme devant le tribunal administratif, en ligne via
        Télérecours citoyens, dans le délai de deux mois. La requête reprend
        l’essentiel de votre recours gracieux : les faits datés, la décision
        visée, les moyens, les pièces. Un dossier tenu depuis le début —
        courriers datés, accusés, pièces numérotées — se transforme en requête
        sans repartir de zéro, et fait gagner des honoraires si un avocat
        prend le relais.
      </p>

      <p>
        Pour les autres faces du dossier d’un professionnel, voyez aussi{" "}
        <Link href="/guides/facture-impayee-que-faire">
          Facture impayée : que faire
        </Link>{" "}
        et{" "}
        <Link href="/guides/preuves-impaye-litige">
          quelles preuves comptent vraiment
        </Link>
        .
      </p>

      <GuideFaq items={FAQ} />
    </GuideShell>
  );
}
