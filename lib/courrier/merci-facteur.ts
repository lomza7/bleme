import "server-only";
import { createHmac } from "node:crypto";
import { getSecret } from "@/lib/secrets";

/*
 * Client Merci Facteur (API 1.2) : authentification + envoi de LRAR.
 *
 * IMPORTANT (règle produit n° 1) : `sendCourrier` DÉBITE et EXPÉDIE
 * immédiatement — il n'existe pas de brouillon côté API pour un courrier
 * unitaire. Ce module n'est donc appelé QUE par le pipeline d'expédition
 * (dispatchLetter), après validation utilisateur loggée dans approval_logs
 * et derrière SEND_ENABLED. Jamais en outil d'agent.
 *
 * Auth : signature HMAC-SHA256 de `serviceId + timestamp` avec la Secret Key,
 * échangée contre un access token valable 24 h (getToken).
 */

const API_BASE = "https://www.merci-facteur.com/api/1.2/prod";

/**
 * Adresse postale côté produit — même forme que cases.debtor_address
 * ({nom, adresse, complement?, codePostal, ville, pays}, + societe).
 */
export type LetterAddress = {
  civilite?: string | null;
  nom?: string | null;
  societe?: string | null;
  adresse: string;
  complement?: string | null;
  codePostal: string;
  ville: string;
  pays?: string | null;
};

let tokenCache: { token: string; expire: number } | null = null;

export async function getMerciFacteurToken(): Promise<
  { token: string } | { error: string }
> {
  if (tokenCache && tokenCache.expire - 3600 > Date.now() / 1000) {
    return { token: tokenCache.token };
  }
  const [serviceId, secretKey] = await Promise.all([
    getSecret("MERCI_FACTEUR_SERVICE_ID"),
    getSecret("MERCI_FACTEUR_SECRET_KEY"),
  ]);
  if (!serviceId || !secretKey) {
    return { error: "MERCI_FACTEUR_SERVICE_ID / MERCI_FACTEUR_SECRET_KEY absents du coffre." };
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secretKey)
    .update(serviceId + timestamp)
    .digest("hex");
  try {
    const res = await fetch(`${API_BASE}/service/getToken`, {
      headers: {
        "ww-service-id": serviceId,
        "ww-timestamp": String(timestamp),
        "ww-service-signature": signature,
      },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.token) {
      return {
        error: `getToken a échoué (${res.status})${payload.error ? ` : ${String(payload.error).slice(0, 150)}` : ""}`,
      };
    }
    tokenCache = { token: payload.token, expire: Number(payload.expire) || 0 };
    return { token: payload.token };
  } catch {
    return { error: "Impossible de joindre l'API Merci Facteur." };
  }
}

// Adresse produit → champs de l'API (adresse1/2, cp ; bornes doc : civilite
// 12 car., lignes d'adresse 90 car.). `reference` est imprimée sur l'AR et
// revient dans les webhooks (ref_interne) : on y met l'id du courrier.
function mfAddress(a: LetterAddress, reference?: string): Record<string, string> {
  const out: Record<string, string> = {
    adresse1: a.adresse.trim().slice(0, 90),
    cp: a.codePostal.trim(),
    ville: a.ville.trim(),
    pays: (a.pays ?? "france").trim().toLowerCase() || "france",
  };
  if (a.civilite?.trim()) out.civilite = a.civilite.trim().slice(0, 12);
  if (a.nom?.trim()) out.nom = a.nom.trim();
  if (a.societe?.trim()) out.societe = a.societe.trim();
  if (a.complement?.trim()) out.adresse2 = a.complement.trim().slice(0, 90);
  if (reference) out.reference = reference.slice(0, 90);
  return out;
}

/**
 * Envoie une lettre recommandée avec AR (mode `lrare` : l'AR signé revient
 * numérisé par webhook). PDF en base64. `antidoublon` (id du courrier) fait
 * rejeter tout doublon sur 30 jours : un double-clic ne part jamais deux fois.
 */
export async function sendRegisteredLetter(input: {
  pdfBase64: string;
  filename: string;
  /** Annexes déjà converties en PDF : imprimées à la suite de la lettre. */
  annexesPdfBase64?: string[];
  exp: LetterAddress;
  dest: LetterAddress;
  reference: string;
}): Promise<{ envoiId: string; priceTtc: string | null } | { error: string }> {
  const auth = await getMerciFacteurToken();
  if ("error" in auth) return auth;
  const serviceId = await getSecret("MERCI_FACTEUR_SERVICE_ID");
  if (!serviceId) return { error: "MERCI_FACTEUR_SERVICE_ID absent du coffre." };

  const body = new URLSearchParams();
  body.set("modeEnvoi", "lrare");
  // Compte multi-utilisateurs : id du sous-compte expéditeur si configuré.
  const idUser = await getSecret("MERCI_FACTEUR_ID_USER");
  if (idUser) body.set("idUser", idUser);
  body.set(
    "adress",
    JSON.stringify({ exp: mfAddress(input.exp), dest: [mfAddress(input.dest, input.reference)] }),
  );
  body.set(
    "content",
    JSON.stringify({
      letter: {
        base64files: [input.pdfBase64, ...(input.annexesPdfBase64 ?? [])],
        print_sides: "recto",
        final_filename: input.filename.slice(0, 80),
      },
    }),
  );
  body.set("antidoublon", input.reference);

  try {
    const res = await fetch(`${API_BASE}/sendCourrier`, {
      method: "POST",
      headers: {
        "ww-access-token": auth.token,
        "ww-service-id": serviceId,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      envoi_id?: number[] | number;
      price?: { total?: { ttc?: number | string } };
      error?: unknown;
    };
    if (!res.ok || !payload.success) {
      return {
        error: `sendCourrier a échoué (${res.status})${payload.error ? ` : ${String(payload.error).slice(0, 200)}` : ""}`,
      };
    }
    const envoiId = Array.isArray(payload.envoi_id)
      ? String(payload.envoi_id[0] ?? "")
      : String(payload.envoi_id ?? "");
    const ttc = payload.price?.total?.ttc;
    return { envoiId, priceTtc: ttc != null ? String(ttc) : null };
  } catch {
    return { error: "Impossible de joindre l'API Merci Facteur (sendCourrier)." };
  }
}
