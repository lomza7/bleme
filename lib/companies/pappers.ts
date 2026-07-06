import "server-only";
import { getSecret } from "@/lib/secrets";
import type { CompanyHit, CompanySnapshot } from "@/lib/companies/types";

/*
 * Entreprises : recherche via l'annuaire officiel gratuit
 * (recherche-entreprises.api.gouv.fr, sans clé, pas de quota → autocomplétion),
 * fiche légale complète via Pappers (clé PAPPERS_API_KEY), récupérée une fois à
 * la création du dossier et stockée (cases.debtor_company). Repli sur l'annuaire
 * si Pappers indisponible. Tout échoue en silence (dégradé) : la saisie manuelle
 * du nom reste toujours possible.
 */

const ANNUAIRE = "https://recherche-entreprises.api.gouv.fr/search";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Autocomplétion : annuaire officiel, gratuit, sans clé. */
export async function searchAnnuaire(query: string): Promise<CompanyHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(`${ANNUAIRE}?q=${encodeURIComponent(q)}&page=1&per_page=6`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((r: any) => ({
      siren: String(r.siren ?? ""),
      nom: r.nom_complet || r.nom_raison_sociale || r.siren || "",
      ville: r.siege?.libelle_commune ?? null,
      codePostal: r.siege?.code_postal ?? null,
      formeJuridique: r.nature_juridique_libelle ?? null,
      radiee: r.etat_administratif === "C",
    })).filter((h: CompanyHit) => h.siren && h.nom);
  } catch {
    return [];
  }
}

/** Fiche complète : Pappers en priorité, repli annuaire. Stockée sur le dossier. */
export async function fetchCompanyFiche(siren: string): Promise<CompanySnapshot | null> {
  const s = (siren ?? "").replace(/\D/g, "");
  if (s.length !== 9) return null;
  const now = new Date().toISOString();

  const key = await getSecret("PAPPERS_API_KEY");
  if (key) {
    try {
      const res = await fetch(
        `https://api.pappers.fr/v2/entreprise?api_token=${encodeURIComponent(key)}&siren=${s}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (res.ok) {
        const d: any = await res.json();
        const reps = (d.representants ?? d.dirigeants ?? []) as any[];
        return {
          source: "pappers",
          siren: s,
          nom: d.nom_entreprise || d.denomination || s,
          formeJuridique: d.forme_juridique ?? null,
          siege: {
            adresse: d.siege?.adresse_ligne_1 ?? d.siege?.adresse ?? null,
            codePostal: d.siege?.code_postal ?? null,
            ville: d.siege?.ville ?? null,
            pays: d.siege?.pays ?? "France",
          },
          dirigeants: reps
            .slice(0, 5)
            .map((x) => ({
              nom: x.nom_complet || [x.prenom, x.nom].filter(Boolean).join(" ") || x.nom || "",
              qualite: x.qualite ?? null,
            }))
            .filter((x) => x.nom),
          capitalCents: typeof d.capital === "number" ? Math.round(d.capital * 100) : null,
          dateCreation: d.date_creation ?? null,
          codeNaf: d.code_naf ?? null,
          libelleNaf: d.libelle_code_naf ?? null,
          enActivite: d.entreprise_cessee !== true,
          procedureCollective: Array.isArray(d.procedures_collectives)
            ? d.procedures_collectives.length > 0
            : Boolean(d.procedure_collective),
          fetchedAt: now,
        };
      }
    } catch {
      /* repli annuaire */
    }
  }

  try {
    const res = await fetch(`${ANNUAIRE}?q=${s}&page=1&per_page=1`, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data: any = await res.json();
      const r = (data.results ?? [])[0];
      if (r) {
        return {
          source: "annuaire",
          siren: s,
          nom: r.nom_complet || r.nom_raison_sociale || s,
          formeJuridique: r.nature_juridique_libelle ?? null,
          siege: {
            adresse: r.siege?.adresse ?? null,
            codePostal: r.siege?.code_postal ?? null,
            ville: r.siege?.libelle_commune ?? null,
            pays: "France",
          },
          dirigeants: (r.dirigeants ?? [])
            .slice(0, 5)
            .map((x: any) => ({
              nom: x.nom_complet || [x.prenoms, x.nom].filter(Boolean).join(" ") || "",
              qualite: x.qualite ?? null,
            }))
            .filter((x: any) => x.nom),
          capitalCents: null,
          dateCreation: r.date_creation ?? null,
          codeNaf: r.activite_principale ?? null,
          libelleNaf: r.libelle_activite_principale ?? null,
          enActivite: r.etat_administratif !== "C",
          procedureCollective: false,
          fetchedAt: now,
        };
      }
    }
  } catch {
    /* rien */
  }
  return null;
}
