import "server-only";
import { createHmac } from "node:crypto";
import { getSecret } from "@/lib/secrets";

/*
 * Client Merci Facteur (API 1.2) — authentification uniquement pour l'instant.
 * L'envoi de courriers (phase 4) passera obligatoirement par le pipeline de
 * validation : aucun envoi sans approbation utilisateur loggée dans
 * approval_logs (règle produit n° 1). Ce module ne fait donc AUCUN envoi.
 *
 * Auth : signature HMAC-SHA256 de `serviceId + timestamp` avec la Secret Key,
 * échangée contre un access token valable 24 h (getToken).
 */

const API_BASE = "https://www.merci-facteur.com/api/1.2/prod";

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
