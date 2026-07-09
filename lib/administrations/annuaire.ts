import "server-only";
import type { AdminAddress, AdminHit } from "@/lib/administrations/types";

/*
 * Annuaire de l'administration (API officielle DILA, OpenDataSoft, sans clé) :
 * https://api-lannuaire.service-public.gouv.fr — toutes les administrations
 * françaises (ministères, préfectures, services fiscaux, juridictions, CAF,
 * bureaux nationaux…) avec leur adresse postale officielle.
 *
 * On s'en sert pour deux choses, jamais pour inventer une adresse :
 *  - autocomplétion à la création d'un dossier « démarche administrative » ;
 *  - résolution d'un NOM proposé par l'agent Basile en adresse RÉELLE (l'agent
 *    ne rédige jamais une adresse, il nomme l'autorité, on la résout ici).
 *
 * Recherche via `where=search(nom,"…")` : le plein-texte `q=` classe très mal
 * (dizaines de milliers de résultats), la recherche sur le champ `nom` est
 * pertinente. Tout échoue en silence (dégradé) → saisie manuelle possible.
 */

const BASE =
  "https://api-lannuaire.service-public.gouv.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Raw = {
  itm_identifiant?: string;
  id?: string;
  nom?: string;
  type_organisme?: string | null;
  adresse?: string | null;
};

/** L'annuaire encode `adresse` comme une CHAÎNE JSON d'un tableau d'adresses. */
function parseAddress(nom: string, raw: string | null | undefined): AdminAddress | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    // Priorité à l'adresse POSTALE (celle où l'on écrit : BP, Cedex…), sinon
    // la première adresse physique.
    const a = arr.find((x: any) => x?.type_adresse === "Adresse postale") ?? arr[0];
    const adresse = String(a.numero_voie ?? "").trim();
    const codePostal = String(a.code_postal ?? "").trim();
    const ville = String(a.nom_commune ?? "").trim();
    if (!codePostal || !ville || (!adresse && !a.service_distribution)) return null;
    const complement = [a.complement1, a.complement2, a.service_distribution]
      .map((x: any) => String(x ?? "").trim())
      .filter(Boolean)
      .join(", ");
    return {
      nom: "",
      societe: nom,
      adresse: adresse || String(a.service_distribution ?? "").trim(),
      complement: adresse ? complement : "",
      codePostal,
      ville,
    };
  } catch {
    return null;
  }
}

function toHit(r: Raw): AdminHit | null {
  const nom = String(r.nom ?? "").trim();
  if (!nom) return null;
  return {
    id: String(r.itm_identifiant ?? r.id ?? ""),
    nom,
    type: r.type_organisme ?? null,
    address: parseAddress(nom, r.adresse),
  };
}

async function query(where: string, limit: number): Promise<AdminHit[]> {
  const url = `${BASE}?where=${encodeURIComponent(where)}&limit=${limit}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data: any = await res.json();
    return (data.results ?? []).map(toHit).filter(Boolean) as AdminHit[];
  } catch {
    return [];
  }
}

// Échappe les guillemets pour l'injection dans la clause ODSQL search(nom,"…").
function esc(q: string): string {
  return q.replace(/["\\]/g, " ").trim();
}

/** Autocomplétion : administrations dont le nom correspond à la requête. */
export async function searchAdministrations(q: string): Promise<AdminHit[]> {
  const term = esc(q);
  if (term.length < 2) return [];
  return query(`search(nom,"${term}")`, 6);
}

/**
 * Résout un NOM d'administration (proposé par l'agent) en fiche + adresse
 * réelle. Renvoie le meilleur résultat exploitable (adresse présente), sinon
 * le premier résultat, sinon null. Ne fabrique jamais d'adresse.
 */
export async function resolveAdministration(nom: string): Promise<AdminHit | null> {
  const term = esc(nom);
  if (term.length < 2) return null;
  const hits = await query(`search(nom,"${term}")`, 5);
  return hits.find((h) => h.address) ?? hits[0] ?? null;
}
