"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CircleAlert,
  Landmark,
  LoaderCircle,
  Scale,
  ShieldQuestion,
} from "lucide-react";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";
import { CompanionCard, type Companion } from "@/components/app/companion-card";
import { CompanySearch } from "@/components/app/company-search";
import { AdminSearch } from "@/components/app/admin-search";
import { VoiceCapture } from "@/components/app/voice-capture";
import { intakeQuestions } from "@/lib/intake/actions";
import { createCaseFromDraft } from "@/lib/cases/actions";
import { EMPTY_DATA, KIND_META, type CaseKind, type WizardData } from "@/components/wizard/types";

const EASE = [0.16, 1, 0.3, 1] as const;

const KINDS: { kind: CaseKind; icon: typeof Banknote; title: string; desc: string; soon?: boolean }[] = [
  { kind: "unpaid", icon: Banknote, title: "Facture impayée", desc: "Un client ne paie pas ce qu’il vous doit." },
  { kind: "dispute", icon: Scale, title: "Litige client", desc: "Un client conteste, réclame ou bloque le paiement." },
  { kind: "admin", icon: Landmark, title: "Démarche administrative", desc: "Une décision à contester, un recours ou une demande à monter." },
];

const STEPS = [
  { key: "kind", label: "Votre blème" },
  { key: "details", label: "Les faits" },
  { key: "story", label: "Votre récit" },
  { key: "devil", label: "Regard adverse" },
  { key: "create", label: "Créer" },
] as const;

const inputCls =
  "w-full rounded-2xl border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand";

function Pills({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={
            value === opt
              ? "rounded-full bg-brand px-3.5 py-1.5 text-sm font-medium text-brand-foreground"
              : "rounded-full border bg-background px-3.5 py-1.5 text-sm transition-colors hover:border-brand/60 hover:bg-brand-soft/50"
          }
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/*
 * Création d'un dossier DANS l'app (utilisateur connecté) : même langage que les
 * phases du dossier — stepper + panneau en carte + agent compagnon sur le côté.
 * Pas de plein écran, pas de /signup : createCaseFromDraft crée et redirige.
 */
export function CreateFlow() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [data, setData] = useState<WizardData>(EMPTY_DATA);
  const [state, action, pending] = useActionState(createCaseFromDraft, {} as { error?: string });
  // Étape « Regard adverse » : questions de Jeanne + réponses, TENUES ICI pour
  // survivre aux allers-retours du stepper (le panneau est démonté/remonté).
  const [devil, setDevil] = useState<{ loading: boolean; questions: string[]; answers: string[] }>({
    loading: false,
    questions: [],
    answers: [],
  });

  const patch = (p: Partial<WizardData>) => setData((d) => ({ ...d, ...p }));

  // Jeanne se lance automatiquement à l'ARRIVÉE sur son étape (plus de bouton
  // « Vérifier ») ; une seule fois — revenir en arrière ne relance pas le run.
  async function askJeanne(current: WizardData) {
    setDevil((d) => (d.loading || d.questions.length ? d : { ...d, loading: true }));
    try {
      const { questions } = await intakeQuestions({
        transcript: current.storyText,
        kind: current.kind ?? "unpaid",
        partyName: current.partyName,
      });
      setDevil({ loading: false, questions, answers: questions.map(() => "") });
    } catch {
      setDevil({ loading: false, questions: [], answers: [] });
    }
  }

  const go = (n: number) => {
    const next = Math.min(Math.max(0, n), STEPS.length - 1);
    setDir(next > step ? 1 : -1);
    setStep(next);
    if (STEPS[next].key === "devil" && !devil.loading && devil.questions.length === 0) {
      void askJeanne(data);
    }
  };

  // Une réponse saisie → agrégat remonté dans devilAnswer (points de vigilance
  // du dossier) ; aucune réponse → rien (le champ reste vide).
  function setDevilAnswer(i: number, v: string) {
    setDevil((prev) => {
      const answers = [...prev.answers];
      answers[i] = v;
      const answered = answers.some((a) => a.trim());
      patch({
        devilAnswer: answered
          ? prev.questions.map((q, k) => `• ${q}\n${answers[k]?.trim() || "—"}`).join("\n\n")
          : "",
      });
      return { ...prev, answers };
    });
  }

  const isUnpaid = data.kind === "unpaid";
  const isAdmin = data.kind === "admin";
  const partyReady = isAdmin
    ? data.needsRecipientHelp || data.partyName.trim() !== ""
    : data.partyName.trim() !== "";
  const detailsReady = isUnpaid
    ? partyReady && data.amount.trim() !== "" && data.age !== ""
    : partyReady && data.subject !== "" && data.stage !== "";

  // ── Compagnon par étape (guide la création, comme dans les phases) ──────────
  // Basile prend le relais sur les démarches administratives.
  const guide: Pick<Companion, "key" | "prenom" | "role"> = isAdmin
    ? { key: "basile", prenom: "Basile", role: "Agent Démarches & recours" }
    : { key: "marius", prenom: "Marius", role: "Agent Impayés" };
  const companions: Companion[] = [
    { ...guide, message: "Choisissez la situation : je monte le dossier avec vous, étape par étape." },
    { ...guide, message: isUnpaid ? "Juste l’essentiel pour ouvrir : qui, combien, depuis quand." : isAdmin ? "Juste l’essentiel : quelle administration, à propos de quoi, où ça en est." : "Juste l’essentiel : avec qui, sur quoi, où ça en est." },
    { key: "nora", prenom: "Nora", role: "Agente Preuves", message: "Racontez librement — j’en tirerai les faits, les dates et la chronologie. C’est optionnel, vous pourrez compléter après." },
    { key: "jeanne", prenom: "Jeanne", role: "Agente Avocat du diable", message: "Je lis votre récit avec les yeux d’en face : mes questions comblent ce qu’on pourrait vous opposer. Répondez même brièvement — et si un détail vous revient, notez-le." },
    { ...guide, message: "Tout est prêt. À la création, le dossier s’ouvre et les agents se mettent au travail. Rien ne part sans votre validation." },
  ];

  // ── Panneaux ────────────────────────────────────────────────────────────────
  const panelKind = (
    <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
      <h2 className="text-lg font-semibold">C’est quoi, votre blème ?</h2>
      <p className="mt-1 text-sm text-muted-foreground">Choisissez la situation qui vous ressemble.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            disabled={k.soon}
            onClick={() => {
              patch({ kind: k.kind });
              go(1);
            }}
            className="group relative flex flex-col rounded-2xl border bg-background p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/60 hover:bg-brand-soft/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {k.soon ? (
              <span className="absolute right-4 top-4 rounded-full bg-brand px-2 py-0.5 text-[10px] font-medium text-brand-foreground">Bientôt</span>
            ) : null}
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
              <k.icon className="size-5" />
            </span>
            <span className="mt-3 font-semibold">{k.title}</span>
            <span className="mt-1 text-xs leading-relaxed text-muted-foreground">{k.desc}</span>
          </button>
        ))}
      </div>
    </section>
  );

  const panelDetails = (
    <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
      <h2 className="text-lg font-semibold">{isUnpaid ? "Les faits, en 30 secondes" : isAdmin ? "La démarche, en 30 secondes" : "Le litige, en 30 secondes"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Juste de quoi ouvrir le dossier — vous détaillerez ensuite.</p>
      <div className="mt-5 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{isUnpaid ? "Qui vous doit de l’argent ?" : isAdmin ? "Quelle administration ou quel service ?" : "Avec qui avez-vous ce litige ?"}</span>
          {isAdmin ? (
            <AdminSearch
              value={data.partyName}
              helpActive={data.needsRecipientHelp}
              onChange={({ name, address }) => patch({ partyName: name, partyAddress: address })}
              onHelp={(active) =>
                patch({ needsRecipientHelp: active, ...(active ? { partyName: "", partyAddress: null } : {}) })
              }
            />
          ) : (
            <CompanySearch value={data.partyName} onChange={({ name, siren }) => patch({ partyName: name, debtorSiren: siren })} />
          )}
        </div>
        {isUnpaid ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Combien, environ ?</span>
              <div className="relative w-44">
                <input className={`${inputCls} pr-9`} placeholder="2 400" inputMode="decimal" value={data.amount} onChange={(e) => patch({ amount: e.target.value.replace(/[^\d\s.,]/g, "") })} />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
              </div>
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Depuis quand attendez-vous ?</span>
              <Pills options={["Moins d’1 mois", "1 à 3 mois", "3 à 6 mois", "Plus de 6 mois"]} value={data.age} onChange={(age) => patch({ age })} />
            </div>
          </>
        ) : isAdmin ? (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">À propos de quoi ?</span>
              <Pills options={["Contester une décision", "Demande gracieuse", "Rectifier une situation", "Amende", "Autre"]} value={data.subject} onChange={(subject) => patch({ subject })} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Où ça en est ?</span>
              <Pills options={["Rien envoyé pour l’instant", "Demande déjà envoyée", "Réponse reçue", "Silence de l’administration"]} value={data.stage} onChange={(stage) => patch({ stage })} />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">À propos de quoi ?</span>
              <Pills options={["Qualité contestée", "Devis contesté", "Livraison refusée", "Remboursement exigé", "Autre"]} value={data.subject} onChange={(subject) => patch({ subject })} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Où ça en est ?</span>
              <Pills options={["Simple désaccord", "Courriers échangés", "Menace d’action", "Procédure entamée"]} value={data.stage} onChange={(stage) => patch({ stage })} />
            </div>
          </>
        )}
      </div>
    </section>
  );

  const panelStory = (
    <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
      <h2 className="text-lg font-semibold">Racontez ce qui s’est passé{data.partyName ? ` avec ${data.partyName}` : ""}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Optionnel, mais c’est ce qui rend le dossier solide. Nora transcrit, vous relisez.</p>
      <div className="mt-5">
        <VoiceCapture value={data.storyText} onChange={(t) => patch({ storyMode: "text", storyText: t })} />
      </div>
    </section>
  );

  // ── Étape « Regard adverse » : Jeanne au travail dès l'arrivée ──────────────
  const panelDevil = (
    <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-brand-soft to-brand/15 ring-1 ring-brand/25">
          <SpriteAvatar src="/agents/jeanne.webp" alt="Jeanne" className="h-9" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Le regard adverse</h2>
          <p className="text-sm text-muted-foreground">
            Jeanne lit votre récit avec les yeux de la partie adverse et pose les questions qui comblent les trous.
          </p>
        </div>
      </div>

      {devil.loading ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-brand-soft/50 p-5 ring-1 ring-brand/20">
          <LoaderCircle className="size-5 animate-spin text-brand-strong" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Jeanne lit votre récit…</p>
            <div className="mt-2 flex flex-col gap-1.5" aria-hidden>
              <span className="h-2.5 w-3/4 animate-pulse rounded bg-brand/15" />
              <span className="h-2.5 w-1/2 animate-pulse rounded bg-brand/15" />
            </div>
          </div>
        </div>
      ) : devil.questions.length > 0 ? (
        <div className="mt-6 rounded-2xl bg-brand-soft/40 p-5 ring-1 ring-brand/20">
          <div className="flex items-center gap-2">
            <ShieldQuestion className="size-4 text-brand-strong" />
            <p className="text-sm font-semibold">Les questions de Jeanne</p>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">Répondez même brièvement — c’est ce qui rend le dossier béton. Optionnel.</p>
          <div className="mt-4 flex flex-col gap-4">
            {devil.questions.map((q, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <p className="text-[13px] font-medium">{q}</p>
                <textarea
                  rows={2}
                  value={devil.answers[i] ?? ""}
                  onChange={(e) => setDevilAnswer(i, e.target.value)}
                  placeholder="Votre réponse (ou laissez vide)"
                  className="w-full rounded-xl border bg-background p-3 text-sm leading-relaxed outline-none transition-colors focus:border-brand"
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-6 rounded-2xl bg-muted/50 px-4 py-5 text-sm text-muted-foreground">
          Pas de question cette fois — vous pouvez continuer, ou compléter votre récit à l’étape précédente.
        </p>
      )}

      {/* Ses questions ravivent des souvenirs : zone libre, versée au récit. */}
      <div className="mt-6 border-t pt-6">
        <p className="text-sm font-medium">Un détail vous revient ?</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Les questions de Jeanne rappellent souvent un fait, une date, un échange. Notez-le ici : il rejoint votre récit.
        </p>
        <textarea
          rows={3}
          value={data.extraContext}
          onChange={(e) => patch({ extraContext: e.target.value })}
          placeholder="Ex. : « en relisant, je me souviens qu’il avait validé le devis par SMS le 12 mars »"
          className="mt-3 w-full rounded-xl border bg-background p-3 text-sm leading-relaxed outline-none transition-colors focus:border-brand"
        />
      </div>
    </section>
  );

  const panelCreate = (
    <section className="rounded-[1.75rem] border bg-card p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-brand text-brand-foreground">
          <Check className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Votre dossier est prêt</h2>
          <p className="text-sm text-muted-foreground">{data.kind ? KIND_META[data.kind].label : ""}{data.partyName ? ` · ${data.partyName}` : ""}{isUnpaid && data.amount ? ` · ${data.amount} €` : ""}</p>
        </div>
      </div>
      <ul className="mt-5 space-y-2 text-sm">
        {(isUnpaid
          ? ["Relance cordiale dès l’ouverture", "Relance ferme à J+7", "Mise en demeure prête à J+15"]
          : isAdmin
            ? ["Pièces classées et faits vérifiés", "Demande ou recours gracieux en brouillon", "Suivi des délais de réponse"]
            : ["Preuves classées et chronologie", "Points de vigilance anticipés", "Réponse circonstanciée en brouillon"]
        ).map((p) => (
          <li key={p} className="flex items-start gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-brand-strong" />
            {p}
          </li>
        ))}
      </ul>
      <form action={action} className="mt-6">
        <input type="hidden" name="draft" value={JSON.stringify(data)} />
        <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Créer le dossier
          {!pending ? <ArrowRight className="size-4" /> : null}
        </button>
        {state.error ? (
          <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-red-600">
            <CircleAlert className="size-4 shrink-0" />
            {state.error}
          </p>
        ) : null}
      </form>
      <p className="mt-3 text-xs text-muted-foreground">Rien n’est envoyé sans votre validation. Vous pourrez tout corriger dans le dossier.</p>
    </section>
  );

  const panels = [panelKind, panelDetails, panelStory, panelDevil, panelCreate];
  const canNext = step === 0 ? Boolean(data.kind) : step === 1 ? detailsReady : true;

  return (
    <div>
      {/* Stepper (même style que les phases du dossier) */}
      <ol className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={s.key} className="flex flex-1 items-center gap-2">
              <button type="button" onClick={() => i <= step && go(i)} className="flex min-w-0 items-center gap-2 text-left">
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${current ? "bg-brand text-brand-foreground" : done ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                <span className={`hidden truncate text-sm font-medium sm:block ${current ? "" : "text-muted-foreground"}`}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 ? <span className={`h-px flex-1 ${done ? "bg-emerald-300" : "bg-border"}`} /> : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={reduce ? false : { opacity: 0, x: 28 * dir }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: -20 * dir }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              {panels[step]}
            </motion.div>
          </AnimatePresence>

          {/* Navigation (l'étape "kind" avance à la sélection ; "create" a son bouton) */}
          <div className="mt-5 flex items-center justify-between">
            <button type="button" onClick={() => go(step - 1)} disabled={step === 0} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-0">
              <ArrowLeft className="size-4" />
              Retour
            </button>
            {step > 0 && step < STEPS.length - 1 ? (
              <button type="button" onClick={() => canNext && go(step + 1)} disabled={!canNext} className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-ink-soft active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40">
                {STEPS[step].key === "devil" ? "Voir le récapitulatif" : "Continuer"}
                <ArrowRight className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        <aside className="lg:sticky lg:top-6">
          <CompanionCard companion={companions[step]} />
        </aside>
      </div>
    </div>
  );
}
