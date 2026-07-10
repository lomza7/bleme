import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { getSecret } from "@/lib/secrets";

/*
 * Chiffrement des tokens d'intégration (AES-256-GCM). La clé maîtresse vit
 * dans le coffre sous INTEGRATIONS_ENCRYPTION_KEY (≥ 32 caractères aléatoires,
 * ex. `openssl rand -base64 32` — longueur imposée à l'enregistrement dans
 * /admin/cles). Dérivation étirée par scrypt (même primitive que le mot de
 * passe du coffre) : une passphrase faible ne se brute-force pas à des
 * milliards d'essais/s sur un dump. Format stocké :
 * v1:<iv b64>:<tag b64>:<chiffré b64>.
 *
 * ⚠️ Changer la clé maîtresse invalide tous les tokens stockés (les
 * utilisateurs devront reconnecter leur intégration) — ne la faire tourner
 * qu'en connaissance de cause.
 */

let cachedKey: { secret: string; key: Buffer } | null = null;

async function masterKey(): Promise<Buffer> {
  const secret = await getSecret("INTEGRATIONS_ENCRYPTION_KEY");
  if (!secret) {
    throw new Error(
      "INTEGRATIONS_ENCRYPTION_KEY manquante : renseignez-la dans le coffre (/admin/cles) ou en variable d'environnement.",
    );
  }
  // scrypt coûte ~50 ms : mémoïsé tant que le secret ne change pas.
  if (!cachedKey || cachedKey.secret !== secret) {
    cachedKey = {
      secret,
      key: scryptSync(secret, "bleme:integrations:v1", 32, { N: 16384, r: 8, p: 1 }),
    };
  }
  return cachedKey.key;
}

export async function encryptToken(plaintext: string): Promise<string> {
  const key = await masterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export async function decryptToken(stored: string): Promise<string> {
  const [version, ivB64, tagB64, dataB64] = stored.split(":");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Token chiffré illisible (format inattendu).");
  }
  const key = await masterKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
