"use client";

import { useState } from "react";
import { Info } from "lucide-react";

/*
 * Encart « impayé type » à onglets (à l'unité / Pro) + simulateur annuel.
 * Règle absolue : on compare des COÛTS (défendre vs alternatives), jamais
 * des résultats — aucun taux de récupération promis. Les statistiques de
 * contexte affichées autour sont sourcées (Coface, Banque de France,
 * Observatoire des délais de paiement, Axonaut, DGFiP).
 */

const PRIX = {
  dossier: 39,
  dossierPro: 19,
  proMois: 9,
  recommande: 10,
} as const;

const eur = (n: number) =>
  `${Math.round(n).toLocaleString("fr-FR")} €`;

// ── Un impayé type, à onglets ────────────────────────────────────────────────

export function ImpayeTypeTabs() {
  const [pro, setPro] = useState(false);
  const dossier = pro ? PRIX.dossierPro : PRIX.dossier;
  const total = dossier + PRIX.recommande;

  return (
    <section className="mx-auto mt-20 max-w-4xl rounded-[2rem] bg-ink p-8 text-ink-foreground sm:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Un impayé type, au total.
          </h2>
          <p className="mt-3 max-w-xl leading-relaxed text-ink-muted">
            Facture de 2 400 € impayée depuis 47 jours : relances par email,
            puis mise en demeure en recommandé.
          </p>
        </div>
        <div className="flex rounded-full bg-white/10 p-1 ring-1 ring-white/10" role="tablist">
          {[
            { label: "À l’unité", value: false },
            { label: "Avec Pro", value: true },
          ].map((t) => (
            <button
              key={t.label}
              role="tab"
              aria-selected={pro === t.value}
              onClick={() => setPro(t.value)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                pro === t.value
                  ? "bg-brand text-brand-foreground shadow"
                  : "text-ink-muted hover:text-ink-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white/10 p-6 ring-1 ring-brand/40">
          <p className="text-sm text-ink-muted">
            {pro ? "Avec BLEME Pro" : "Avec BLEME"}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
            {eur(total)} HT
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            Dossier {eur(dossier)} + recommandé AR {eur(PRIX.recommande)}.
            {pro
              ? ` L’abonnement Pro (${eur(PRIX.proMois)} HT/mois) divise le prix du dossier par deux.`
              : " Et 29 € HT pour un abonné Pro."}
          </p>
        </div>
        <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
          <p className="text-sm text-ink-muted">Mise en demeure par avocat</p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-ink-muted">
            90 à 300 €
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            Tarif généralement constaté pour un courrier seul, sans le suivi.
          </p>
        </div>
        <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
          <p className="text-sm text-ink-muted">Société de recouvrement</p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-ink-muted">
            240 à 480 €
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            10 à 20 % de commission prélevée sur votre facture de 2 400 €.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Simulateur : votre année ─────────────────────────────────────────────────

const STATS = [
  {
    chiffre: "86 %",
    texte: "des entreprises françaises ont subi des retards de paiement sur les 12 derniers mois",
    source: "Coface, 2025",
  },
  {
    chiffre: "1 sur 4",
    texte: "des défaillances d’entreprises est liée aux retards de paiement et à la trésorerie",
    source: "Banque de France",
  },
  {
    chiffre: "15 Md€",
    texte: "de trésorerie perdue chaque année par les TPE et PME à cause des retards",
    source: "Observatoire des délais de paiement",
  },
  {
    chiffre: "27 597 €",
    texte: "de factures impayées en moyenne dans une TPE française début 2024",
    source: "Observatoire Axonaut",
  },
];

export function SimulateurAnnee() {
  const [nb, setNb] = useState(3);
  const [montant, setMontant] = useState(1800);

  const enJeu = nb * montant;
  const indemnites = nb * 40;
  const coutUnite = nb * (PRIX.dossier + PRIX.recommande);
  const coutPro = 12 * PRIX.proMois + nb * (PRIX.dossierPro + PRIX.recommande);
  const meilleur = Math.min(coutUnite, coutPro);
  const partDefense = enJeu > 0 ? (meilleur / enJeu) * 100 : 0;
  const recouvreur = enJeu * 0.15;

  return (
    <section className="mx-auto mt-20 max-w-4xl">
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Votre année, en vrai.
      </h2>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
        Les impayés ne sont pas un accident rare : c’est une ligne de votre
        compte de résultat. Réglez le simulateur sur votre situation, et
        regardez ce que coûte le fait de défendre cet argent, plutôt que de
        l’abandonner.
      </p>

      {/* Le contexte, sourcé */}
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.chiffre} className="rounded-[1.5rem] border bg-card p-5">
            <p className="text-2xl font-bold tabular-nums tracking-tight text-brand-strong">
              {s.chiffre}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {s.texte}
            </p>
            <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/70">
              {s.source}
            </p>
          </div>
        ))}
      </div>

      {/* Le simulateur */}
      <div className="mt-6 overflow-hidden rounded-[2rem] border bg-card">
        <div className="grid grid-cols-1 gap-8 p-7 sm:grid-cols-2 sm:p-9">
          <label className="block">
            <span className="flex items-baseline justify-between text-sm font-medium">
              Impayés dans l’année
              <span className="text-2xl font-bold tabular-nums text-brand-strong">
                {nb}
              </span>
            </span>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={nb}
              onChange={(e) => setNb(Number(e.target.value))}
              className="mt-3 w-full accent-brand"
            />
            <span className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>1</span>
              <span>8</span>
            </span>
          </label>
          <label className="block">
            <span className="flex items-baseline justify-between text-sm font-medium">
              Montant moyen par facture
              <span className="text-2xl font-bold tabular-nums text-brand-strong">
                {eur(montant)}
              </span>
            </span>
            <input
              type="range"
              min={300}
              max={10000}
              step={100}
              value={montant}
              onChange={(e) => setMontant(Number(e.target.value))}
              className="mt-3 w-full accent-brand"
            />
            <span className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>300 €</span>
              <span>10 000 €</span>
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 border-t sm:grid-cols-3">
          <div className="p-7 sm:p-8">
            <p className="text-sm text-muted-foreground">
              L’argent en jeu sur l’année
            </p>
            <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight">
              {eur(enJeu)}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {nb} facture{nb > 1 ? "s" : ""} × {eur(montant)}. Sans action,
              cet argent dort chez vos débiteurs.
            </p>
          </div>
          <div className="border-t p-7 sm:border-l sm:border-t-0 sm:p-8">
            <p className="text-sm text-muted-foreground">
              Les défendre avec BLEME
            </p>
            <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-brand-strong">
              {eur(meilleur)} HT
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {coutPro < coutUnite
                ? `Avec Pro : ${eur(12 * PRIX.proMois)} d’abonnement + ${nb} dossier${nb > 1 ? "s" : ""} à ${eur(PRIX.dossierPro + PRIX.recommande)} (recommandé compris). À l’unité : ${eur(coutUnite)}.`
                : `${nb} dossier${nb > 1 ? "s" : ""} à ${eur(PRIX.dossier + PRIX.recommande)}, recommandé compris. Avec Pro : ${eur(coutPro)}.`}
            </p>
          </div>
          <div className="border-t bg-brand-soft/40 p-7 sm:border-l sm:border-t-0 sm:p-8">
            <p className="text-sm text-brand-strong">
              Soit {partDefense < 1 ? partDefense.toFixed(1).replace(".", ",") : Math.round(partDefense)} % des sommes en jeu
            </p>
            <p className="mt-2 text-[15px] leading-relaxed">
              Et la loi joue pour vous : entre pros,{" "}
              <strong>{eur(indemnites)} d’indemnités forfaitaires</strong>{" "}
              (40 € par facture en retard) sont réclamables de plein droit,
              en plus du principal.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              Une société de recouvrement à 15 % prélèverait{" "}
              {eur(recouvreur)} sur ces mêmes sommes.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground/80">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Ce simulateur compare des coûts, jamais des résultats : BLEME ne
          prédit pas l’issue d’un dossier et ne promet aucun taux de
          récupération. Statistiques de contexte : Coface (enquête
          comportements de paiement, 2025), Banque de France et Observatoire
          des délais de paiement (rapport 2024), Observatoire de la
          trésorerie des TPE-PME Axonaut (2024).
        </span>
      </p>
    </section>
  );
}
