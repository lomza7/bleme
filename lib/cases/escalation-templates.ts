// Modèles d'escalade (Phase 3). Module PUR (pas de "use server" : n'exporte que
// des helpers non-async). Vocabulaire strictement documentaire : « modèle »,
// « étape », « à faire valider par un professionnel en cas de doute ». Aucun
// pronostic, aucune évaluation de chances, aucun conseil.

import { FIXED_INDEMNITY_CENTS } from "@/lib/cases/constants";

export type EscalationModel = "recovery_mandate" | "payment_order_request" | "settlement_plan";

export const ESCALATION_MODELS: Record<
  EscalationModel,
  { label: string; hint: string; disclaimer: string; sends: boolean }
> = {
  recovery_mandate: {
    label: "Recouvrement amiable",
    hint: "Informer le client que la créance sera confiée à une société de recouvrement.",
    disclaimer: "Courrier envoyé en votre nom après votre validation.",
    sends: true,
  },
  settlement_plan: {
    label: "Proposition d’échéancier",
    hint: "Proposer un plan de règlement en plusieurs fois pour solder la créance.",
    disclaimer: "Courrier envoyé en votre nom après votre validation.",
    sends: true,
  },
  payment_order_request: {
    label: "Modèle de requête en injonction de payer",
    hint: "Trame procédurale à compléter et à déposer vous-même au greffe.",
    disclaimer: "Modèle à compléter et déposer vous-même. À faire valider par un professionnel en cas de doute.",
    sends: false,
  },
};

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Construit le modèle d'escalade depuis un gabarit conforme et les faits du
 * dossier. Les mentions légales (indemnité 40 € art. D441-5) sont des mentions
 * de template, jamais inventées.
 */
export function buildEscalation(
  model: EscalationModel,
  c: { debtor_name: string; amount_claimed_cents: number; title: string },
  orgName: string,
): { subject: string; body: string } {
  const montant = euros(c.amount_claimed_cents);
  const indemnity = euros(FIXED_INDEMNITY_CENTS);
  const signature = `\n\nCordialement,\n${orgName}`;

  if (model === "recovery_mandate") {
    return {
      subject: `Avant recouvrement — ${c.title}`,
      body:
        `Madame, Monsieur,\n\n` +
        `Malgré nos relances et notre mise en demeure, la somme de ${montant} € demeure impayée à ce jour.\n\n` +
        `À défaut de règlement sous quinzaine, nous confierons le recouvrement de cette créance à une société de recouvrement amiable, ` +
        `ce qui est susceptible d'entraîner des frais supplémentaires dans les conditions prévues par la loi.\n\n` +
        `Nous privilégions une résolution amiable et restons à votre disposition pour convenir des modalités de règlement.` +
        signature,
    };
  }
  if (model === "settlement_plan") {
    return {
      subject: `Proposition d’échéancier — ${montant} €`,
      body:
        `Madame, Monsieur,\n\n` +
        `Afin de solder la somme de ${montant} € restant due, nous vous proposons un échéancier de règlement :\n\n` +
        `[À compléter : nombre d'échéances, montant et date de chacune.]\n\n` +
        `Cet échéancier suspend nos démarches tant qu'il est respecté. ` +
        `Nous vous remercions de nous retourner votre accord daté et signé.` +
        signature,
    };
  }
  // payment_order_request — trame procédurale, jamais un envoi en votre nom.
  return {
    subject: `Modèle — requête en injonction de payer (${montant} €)`,
    body:
      `MODÈLE — REQUÊTE EN INJONCTION DE PAYER\n` +
      `(à compléter et à déposer au greffe ; à faire valider par un professionnel en cas de doute)\n\n` +
      `À l'attention de : [Greffe du tribunal compétent]\n\n` +
      `Demandeur : ${orgName}\n` +
      `Défendeur : ${c.debtor_name}\n\n` +
      `Objet : requête en injonction de payer (articles 1405 et suivants du Code de procédure civile)\n\n` +
      `Montant en principal réclamé : ${montant} €\n` +
      `Indemnité forfaitaire de recouvrement : ${indemnity} € (article D441-5 du Code de commerce)\n` +
      `Intérêts de retard : au taux applicable\n\n` +
      `Pièces jointes : facture, mise en demeure et son accusé de réception, échanges, preuve de livraison.\n\n` +
      `Fait à ......................, le ......................\n` +
      `Signature :`,
  };
}
