"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpenText, ChevronDown, History, LoaderCircle } from "lucide-react";
import { Markdown } from "@/components/app/markdown";
import { getContextVersion } from "@/lib/cases/context-actions";

/*
 * « Contexte du dossier » — ce que le dossier sait, consigné au fil des
 * évènements. Panneau REPLIABLE (fermé par défaut, prend peu de place ; placé
 * en bas de la page dossier). Chaque version est HORODATÉE (serveur) et FIGÉE
 * (journal append-only) : l'historique montre ce qu'on savait, et quand.
 * Lecture seule absolue (aucune restauration/édition — contrat d'opposabilité).
 * Toutes les dates arrivent déjà formatées du serveur (zéro mismatch d'hydratation).
 */

export type ContextVersionMeta = {
  version: number;
  causeLabel: string;
  createdAtLabel: string;
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function CaseContextPanel({
  caseId,
  contentMd,
  version,
  consignedAtLabel,
  pending,
  versions,
  defaultOpen = false,
}: {
  caseId: string;
  contentMd: string | null;
  version: number;
  consignedAtLabel: string | null;
  pending: boolean;
  versions: ContextVersionMeta[];
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(defaultOpen);
  const [justUpdated, setJustUpdated] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const prevVersion = useRef(version);

  // « Mis à jour à l'instant » : la version a monté depuis le dernier rendu client.
  useEffect(() => {
    if (version > prevVersion.current) {
      prevVersion.current = version;
      setJustUpdated(true);
      const t = setTimeout(() => setJustUpdated(false), 4000);
      return () => clearTimeout(t);
    }
    prevVersion.current = version;
  }, [version]);

  // Watcher temps réel : quand une génération est en cours, on interroge l'état
  // (~60 octets) toutes les 5 s, onglet visible uniquement, 24 essais max ; à
  // l'incrément de version → router.refresh() recharge le RSC (nouveau contenu).
  // Tourne même panneau replié (le badge d'état reste visible dans l'en-tête).
  useEffect(() => {
    if (!pending) return;
    let tries = 0;
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      tries += 1;
      try {
        const res = await fetch(`/api/cases/${caseId}/brief-state`, { cache: "no-store" });
        if (res.ok) {
          const d = (await res.json()) as { version: number; pending: boolean };
          if (d.version > version || !d.pending) {
            stopped = true;
            router.refresh();
            return;
          }
        }
      } catch {
        /* réseau de chantier : on retentera au prochain tick */
      }
      if (tries >= 24) stopped = true;
    };
    check();
    const id = setInterval(() => {
      if (stopped) clearInterval(id);
      else void check();
    }, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible" && !stopped) void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pending, version, caseId, router]);

  const sections = (contentMd ?? "").split(/\n(?=## )/).filter((s) => s.trim());
  const teaser = pending
    ? "Mise à jour en cours…"
    : version > 0
      ? `${sections.length} rubrique${sections.length > 1 ? "s" : ""}${consignedAtLabel ? ` · consigné le ${consignedAtLabel}` : ""}`
      : "Le contexte se constitue au fil du dossier.";

  return (
    <section className="overflow-hidden rounded-[1.5rem] border bg-card">
      {/* En-tête cliquable : ouvre / referme le panneau */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/30 sm:p-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
            <BookOpenText className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-base font-semibold">Contexte du dossier</span>
              <StateBadge justUpdated={justUpdated} pending={pending} version={version} reduce={reduce} />
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{teaser}</span>
          </span>
        </span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Corps replié/déplié */}
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t px-4 pb-5 pt-4 sm:px-5">
              <p className="text-xs text-muted-foreground">
                Ce que le dossier sait, consigné au fil des évènements — chaque version est horodatée et conservée telle quelle.
              </p>

              {sections.length > 0 ? (
                <div className="mt-4">
                  {sections.map((s, i) => (
                    <motion.div
                      key={`${version}-${i}`}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: EASE, delay: reduce ? 0 : Math.min(i * 0.05, 0.4) }}
                      className="mt-4 first:mt-0"
                    >
                      <Markdown content={s} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="mt-4">
                  <div className="flex flex-col gap-2" aria-hidden>
                    <span className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                    <span className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                    <span className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Le contexte du dossier se constitue — quelques instants.
                  </p>
                </div>
              )}

              {/* Historique daté (lecture seule absolue) */}
              {versions.length > 0 ? (
                <div className="mt-6 border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setShowHistory((v) => !v)}
                    aria-expanded={showHistory}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <History className="size-4" />
                    Historique des versions ({versions.length})
                    <ChevronDown className={`size-4 transition-transform ${showHistory ? "rotate-180" : ""}`} />
                  </button>
                  {showHistory ? (
                    <ol className="mt-4 border-l pl-4">
                      {versions.map((v) => (
                        <HistoryRow key={v.version} caseId={caseId} meta={v} current={v.version === version} />
                      ))}
                    </ol>
                  ) : null}
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function StateBadge({
  justUpdated,
  pending,
  version,
  reduce,
}: {
  justUpdated: boolean;
  pending: boolean;
  version: number;
  reduce: boolean | null;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {justUpdated ? (
        <motion.span
          key="updated"
          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800"
        >
          Mis à jour à l’instant
        </motion.span>
      ) : pending ? (
        <span
          key="pending"
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-medium text-brand-strong"
        >
          <span className="size-1.5 rounded-full bg-brand motion-safe:animate-pulse" />
          en cours…
        </span>
      ) : version > 0 ? (
        <span key="upto" className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          v{version}
        </span>
      ) : null}
    </AnimatePresence>
  );
}

function HistoryRow({
  caseId,
  meta,
  current,
}: {
  caseId: string;
  meta: ContextVersionMeta;
  current: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<{ md: string; sha: string } | null>(null);

  async function toggle() {
    if (current) return; // la version courante est déjà affichée au-dessus
    if (open) return setOpen(false);
    setOpen(true);
    if (!content) {
      setLoading(true);
      const res = await getContextVersion({ caseId, version: meta.version });
      if (res.contentMd) setContent({ md: res.contentMd, sha: res.sha256 ?? "" });
      setLoading(false);
    }
  }

  return (
    <li className="relative py-1">
      <span
        className={`absolute -left-[1.3rem] top-3 size-2 rounded-full ${current ? "bg-foreground" : "bg-muted-foreground/40"}`}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={current}
        className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg px-1 py-2 text-left text-sm transition-colors enabled:hover:bg-muted/50"
      >
        <span className="font-mono text-xs tabular-nums">v{meta.version}</span>
        <span className="text-xs text-muted-foreground">· {meta.createdAtLabel}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">· {meta.causeLabel}</span>
        {current ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">actuelle</span>
        ) : (
          <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {open && !current ? (
        <div className="mb-2 ml-1 rounded-2xl bg-muted/40 p-4">
          {loading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle className="size-3.5 animate-spin" /> Chargement…
            </p>
          ) : content ? (
            <>
              <p className="text-[11px] text-muted-foreground">
                Consignée le {meta.createdAtLabel}
                {content.sha ? ` · empreinte ${content.sha.slice(0, 8)}` : ""}
              </p>
              <div className="mt-3 max-h-[50vh] overflow-y-auto">
                <Markdown content={content.md} />
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Version indisponible.</p>
          )}
        </div>
      ) : null}
    </li>
  );
}
