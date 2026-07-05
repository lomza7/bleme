import type { Metadata } from "next";
import { LockKeyhole, ShieldCheck, Trash2, Unlock } from "lucide-react";
import { deleteApiKey, getKeysStatus, lockVault } from "@/lib/admin/secrets-actions";
import {
  SetKeyForm,
  TestAnthropicButton,
  VaultSetupForm,
  VaultUnlockForm,
} from "@/components/admin/secrets";

export const metadata: Metadata = { title: "Clés & API" };

/*
 * Coffre des clés d'API : protégé par le rôle admin PLUS un mot de passe
 * dédié (session de 15 minutes). Les valeurs ne sont jamais affichées en
 * clair (préfixe + 4 derniers caractères). Résolution côté code : base
 * d'abord, ENV en repli — poser une clé ici la rend effective sans
 * redéploiement.
 */

const REGISTRY: { name: string; service: string; usage: string; testable?: boolean }[] = [
  {
    name: "ANTHROPIC_API_KEY",
    service: "Anthropic (Claude)",
    usage: "Le moteur des 6 agents : intake, extraction, courriers. Débloque les phases 0 à 3.",
    testable: true,
  },
  {
    name: "GROQ_API_KEY",
    service: "Groq (Whisper)",
    usage: "Transcription des récits vocaux (phase 1).",
  },
  {
    name: "RESEND_API_KEY",
    service: "Resend",
    usage: "Envoi des relances email et notifications (phase 4, après le domaine).",
  },
  {
    name: "MERCI_FACTEUR_API_KEY",
    service: "Merci Facteur",
    usage: "Recommandés papier avec AR et suivi (phase 4).",
  },
  {
    name: "STRIPE_SECRET_KEY",
    service: "Stripe",
    usage: "Paiement des dossiers et abonnement Pro (phase 6).",
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    service: "Stripe (webhooks)",
    usage: "Signature des événements de paiement entrants (phase 6).",
  },
];

export default async function ClesAdminPage() {
  const { unlocked, hasVault, keys } = await getKeysStatus();

  if (!hasVault) {
    return (
      <div className="mx-auto max-w-xl">
        <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
          <ShieldCheck className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Créer le coffre des clés</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Cette page gérera les clés d’API de la plateforme (Anthropic,
          Groq, Resend, Merci Facteur, Stripe). Sécurité supplémentaire :
          définissez un mot de passe dédié, distinct de votre mot de passe
          de connexion. Il sera demandé à chaque session pour ouvrir le
          coffre.
        </p>
        <div className="mt-6">
          <VaultSetupForm />
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-xl">
        <span className="flex size-12 items-center justify-center rounded-full bg-ink text-white">
          <LockKeyhole className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Coffre verrouillé</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Les clés d’API sont protégées par le mot de passe du coffre, en
          plus de votre session administrateur.
        </p>
        <div className="mt-6">
          <VaultUnlockForm />
        </div>
      </div>
    );
  }

  const byName = new Map(keys.map((k) => [k.name, k]));
  const custom = keys.filter((k) => !REGISTRY.some((r) => r.name === k.name));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Clés & API</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Base d’abord, ENV en repli : une clé posée ici est effective
            immédiatement, sans redéploiement. Valeurs jamais affichées en
            clair.
          </p>
        </div>
        <form action={lockVault}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
          >
            <Unlock className="size-4" />
            Verrouiller le coffre
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border bg-card">
        {REGISTRY.map((entry, i) => {
          const status = byName.get(entry.name);
          return (
            <div key={entry.name} className={`px-6 py-5 sm:px-7 ${i > 0 ? "border-t" : ""}`}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <p className="font-semibold">{entry.service}</p>
                <code className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {entry.name}
                </code>
                {status ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                      status.source === "console"
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-sky-50 text-sky-700 ring-sky-200"
                    }`}
                  >
                    {status.source === "console" ? "Configurée · console" : "Configurée · ENV"}
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-black/5">
                    Manquante
                  </span>
                )}
                {status ? (
                  <code className="ml-auto font-mono text-xs text-muted-foreground">
                    {status.masked}
                  </code>
                ) : null}
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {entry.usage}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <SetKeyForm presetName={entry.name} compact />
                {status?.source === "console" ? (
                  <form action={deleteApiKey}>
                    <input type="hidden" name="name" value={entry.name} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-red-300 hover:text-red-600"
                      title="Retirer la clé du coffre (retombe sur l'ENV si présente)"
                    >
                      <Trash2 className="size-3.5" />
                      Retirer
                    </button>
                  </form>
                ) : null}
                {entry.testable ? <TestAnthropicButton /> : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Clés personnalisées */}
      <section>
        <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Autres clés
        </h2>
        {custom.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-[1.75rem] border bg-card">
            {custom.map((k, i) => (
              <div
                key={k.name}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4 ${i > 0 ? "border-t" : ""}`}
              >
                <code className="font-mono text-xs">{k.name}</code>
                <code className="font-mono text-xs text-muted-foreground">{k.masked}</code>
                <form action={deleteApiKey} className="ml-auto">
                  <input type="hidden" name="name" value={k.name} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-red-300 hover:text-red-600"
                  >
                    <Trash2 className="size-3.5" />
                    Retirer
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-3 rounded-[1.75rem] border border-dashed bg-card px-6 py-5">
          <p className="text-sm font-medium">Ajouter une clé personnalisée</p>
          <SetKeyForm />
        </div>
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground/80">
        Le coffre vit dans une table sans aucune policy d’accès (service
        role uniquement), le mot de passe est haché (scrypt) et la session
        de déverrouillage expire après 15 minutes. Changer une valeur ici
        prend effet à l’appel suivant du code concerné.
      </p>
    </div>
  );
}
