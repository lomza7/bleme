import type { Metadata } from "next";
import Link from "next/link";
import { GuideFaq, GuideShell, guideJsonLd } from "@/components/guides/guide-shell";
import { JsonLd } from "@/components/seo/json-ld";

const TITLE = "Emails, WhatsApp, photos : quelles preuves comptent en cas d'impayé ou de litige";
const DESCRIPTION =
  "Entre professionnels, la preuve est libre (article L110-3 du Code de commerce) : emails, messages WhatsApp, SMS et photos datées sont recevables en justice. Face à un particulier, un écrit est exigé au-delà de 1 500 €. Ce qui est recevable, comment le conserver, et ce qui fait un dossier convaincant.";
const UPDATED = "5 juillet 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/preuves-impaye-litige" },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  {
    q: "Une conversation WhatsApp est-elle recevable devant un tribunal ?",
    r: "Oui. Entre professionnels, la preuve est libre et les messages WhatsApp, SMS ou Messenger sont régulièrement admis, dès lors qu'ils ont été obtenus loyalement (votre propre conversation, pas celle d'autrui piratée). L'export officiel de la conversation, qui conserve dates et auteurs, vaut mieux qu'une capture isolée facilement contestable.",
  },
  {
    q: "Une capture d'écran suffit-elle comme preuve ?",
    r: "Elle est recevable, mais sa force dépend de son intégrité apparente : une capture recadrée sans contexte se conteste facilement. Préférez l'export complet de la conversation, conservez l'original sur l'appareil, et pour un enjeu important, faites établir un constat par commissaire de justice qui fige le contenu de manière incontestable.",
  },
  {
    q: "Un accord donné oralement ou par téléphone a-t-il une valeur ?",
    r: "Un contrat oral est valable entre professionnels, mais sa preuve repose sur vous : sans écrit, c'est parole contre parole. Le réflexe : confirmer chaque accord téléphonique par un email ou un message (« Comme convenu à l'instant : démarrage lundi, +480 € pour le poste supplémentaire »). Le silence du client face à un écrit précis pèse déjà en votre faveur.",
  },
  {
    q: "Mes photos de chantier ont-elles une valeur de preuve ?",
    r: "Oui, surtout datées et mises en contexte : les métadonnées du téléphone (date, heure, GPS) renforcent la crédibilité, et une série avant/pendant/après documente l'exécution mieux qu'un long texte. Envoyées au client par message au fil du chantier, elles deviennent doublement utiles : preuves de l'avancement et de son absence d'objection.",
  },
  {
    q: "Combien de temps dois-je conserver mes preuves ?",
    r: "Au minimum le temps de la prescription de la créance (5 ans entre professionnels, 2 ans face à un particulier), et 10 ans pour les documents comptables dont les factures. En pratique : conservez le dossier complet (devis, échanges, photos, relances) tant que le paiement intégral n'est pas acquis et le délai de recours écoulé.",
  },
];

export default function Page() {
  return (
    <GuideShell title={TITLE} updated={UPDATED}>
      {guideJsonLd({
        slug: "preuves-impaye-litige",
        title: TITLE,
        description: DESCRIPTION,
        updated: "2026-07-05",
        faq: FAQ,
      }).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}

      <p>
        <strong>Entre professionnels, la preuve est libre : emails, messages
        WhatsApp, SMS, photos datées et témoignages sont recevables pour
        établir un accord ou l’exécution d’une prestation</strong> (article
        L110-3 du Code de commerce). Face à un particulier, un écrit est en
        principe exigé au-delà de 1 500 € (article 1359 du Code civil). Dans
        les deux cas, la question n’est pas seulement « est-ce
        recevable ? » mais « est-ce convaincant ? » — et là, la manière de
        collecter et conserver vos échanges fait toute la différence.
      </p>

      <h2>Ce que vaut chaque type de preuve</h2>
      <table>
        <thead>
          <tr>
            <th>Preuve</th>
            <th>Force</th>
            <th>Le réflexe qui la renforce</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Devis signé, contrat</td>
            <td>Maximale</td>
            <td>Mentions complètes, un exemplaire conservé signé</td>
          </tr>
          <tr>
            <td>Email</td>
            <td>Forte</td>
            <td>Conserver l’original (pas seulement une impression)</td>
          </tr>
          <tr>
            <td>WhatsApp / SMS</td>
            <td>Forte entre pros</td>
            <td>Export officiel de la conversation, original conservé</td>
          </tr>
          <tr>
            <td>Photos de chantier</td>
            <td>Bonne</td>
            <td>Métadonnées intactes, série datée, envoyées au client</td>
          </tr>
          <tr>
            <td>Capture d’écran isolée</td>
            <td>Moyenne</td>
            <td>Constat de commissaire de justice si l’enjeu le mérite</td>
          </tr>
          <tr>
            <td>Souvenir d’un accord oral</td>
            <td>Faible</td>
            <td>Toujours confirmer par écrit dans la journée</td>
          </tr>
        </tbody>
      </table>

      <h2>La règle d’obtention : la loyauté</h2>
      <p>
        Une preuve doit être obtenue loyalement : vos propres conversations
        et emails, oui ; le téléphone d’un tiers consulté à son insu, non.
        Les messages que le client vous a adressés sont à vous — les
        produire en justice ne pose aucun problème. En matière civile et
        commerciale, la jurisprudence récente admet même, sous conditions
        strictes, des preuves obtenues de façon imparfaite quand elles sont
        indispensables — mais un dossier bien tenu n’a jamais besoin d’en
        arriver là.
      </p>

      <h2>Les preuves qui gagnent les dossiers d’impayés</h2>
      <ul>
        <li>
          <strong>L’accord</strong> : le{" "}
          <Link href="/guides/devis-signe-valeur-juridique">devis signé</Link>{" "}
          ou, à défaut, le message « c’est bon pour moi, vous pouvez
          lancer ».
        </li>
        <li>
          <strong>L’exécution</strong> : bon de livraison, PV de réception,
          photos datées avant/après, message du client satisfait.
        </li>
        <li>
          <strong>La reconnaissance de dette</strong> : « je vous règle la
          semaine prochaine » — ce message interrompt la{" "}
          <Link href="/guides/prescription-facture-impayee">
            prescription
          </Link>{" "}
          et ruine une contestation ultérieure.
        </li>
        <li>
          <strong>La diligence</strong> :{" "}
          <Link href="/guides/relance-facture-impayee">relances</Link>{" "}
          datées,{" "}
          <Link href="/guides/mise-en-demeure-de-payer">mise en demeure</Link>{" "}
          et son accusé de réception.
        </li>
      </ul>
      <p>
        C’est exactement la logique d’un dossier BLEME : chaque pièce est
        datée, classée et rattachée à la chronologie — y compris les exports
        WhatsApp, lus automatiquement pour en extraire les messages clés.
      </p>

      <h2>Les erreurs qui affaiblissent un dossier</h2>
      <ul>
        <li>
          <strong>Supprimer la conversation d’origine</strong> après une
          capture : l’original est votre meilleure défense contre une
          contestation d’authenticité.
        </li>
        <li>
          <strong>Négocier uniquement par téléphone</strong> : chaque appel
          important mérite son email de confirmation.
        </li>
        <li>
          <strong>Retoucher ou recadrer</strong> une photo ou une capture :
          le gain visuel ne vaut jamais le soupçon créé.
        </li>
        <li>
          <strong>Attendre le litige pour collecter</strong> : les preuves
          se constituent pendant le chantier, pas six mois après — voir
          aussi{" "}
          <Link href="/guides/client-conteste-travaux-facture">
            que faire quand le client conteste
          </Link>
          .
        </li>
      </ul>

      <GuideFaq items={FAQ} />
    </GuideShell>
  );
}
