"use client";

import { type ReactNode, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Copy, Inbox, MessageCircle, Smartphone, X } from "lucide-react";
import { SpriteAvatar } from "@/components/landing/sprite-avatar";

/*
 * Deux façons d'apporter des pièces « du monde extérieur », expliquées par Nora :
 * - EmailPieceModal : transférer un email à l'adresse de l'espace.
 * - WhatsAppHelpModal : exporter une conversation WhatsApp (.txt) ou déposer des
 *   captures de SMS (lues en vision).
 * Purement informatif — aucun envoi, aucune écriture. Registre non-juridique.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

function Shell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        role="dialog"
        aria-modal
        initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] border bg-card shadow-2xl"
      >
        {children}
      </motion.div>
    </div>
  );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b bg-gradient-to-b from-brand-soft/70 to-card p-5">
      <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-brand-soft to-brand/15 ring-1 ring-brand/25">
        <SpriteAvatar src="/agents/nora.webp" alt="Nora" className="h-10" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">Nora · Agente Preuves</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copier l’adresse"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* presse-papiers indisponible */
        }
      }}
      className="inline-flex max-w-full items-center gap-2 rounded-full bg-ink px-4 py-2 font-mono text-[13px] text-white transition-all duration-300 hover:bg-ink-soft active:scale-[0.98]"
    >
      <span className="truncate">{address}</span>
      {copied ? (
        <Check className="size-3.5 shrink-0 text-emerald-400" />
      ) : (
        <Copy className="size-3.5 shrink-0 opacity-70" />
      )}
    </button>
  );
}

/** Popup « Ajouter par email » : adresse de transfert + mode d'emploi. */
export function EmailPieceModal({ address, onClose }: { address?: string; onClose: () => void }) {
  const addr = address || "b-votreadresse@dossiers.bleme.fr";
  return (
    <Shell onClose={onClose}>
      <Header title="Ajouter par email" onClose={onClose} />
      <div className="overflow-y-auto p-5">
        <p className="text-sm text-muted-foreground">
          Transférez-moi n’importe quel email — avec ses pièces jointes — à l’adresse de votre espace.
          Il arrive dans votre <span className="font-medium text-foreground">Boîte de réception</span>,
          où vous n’avez plus qu’à le verser à ce dossier : je le lis et je le classe.
        </p>

        <div className="mt-4 flex flex-col items-start gap-2 rounded-2xl bg-muted/50 p-4">
          <span className="text-xs font-medium text-muted-foreground">L’adresse de votre espace</span>
          <CopyAddress address={addr} />
        </div>

        <ol className="mt-4 space-y-2.5 text-sm text-muted-foreground">
          <li className="flex gap-2.5">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-strong">1</span>
            Depuis votre messagerie, transférez l’email à cette adresse (ou mettez-la en copie).
          </li>
          <li className="flex gap-2.5">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-strong">2</span>
            <span className="inline-flex flex-wrap items-center gap-1">
              Il apparaît dans votre <Inbox className="inline size-3.5" /> Boîte de réception.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-strong">3</span>
            Cliquez « Verser au dossier » et choisissez ce dossier — la pièce y est ajoutée, lue et classée.
          </li>
        </ol>

        <p className="mt-4 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs leading-relaxed text-emerald-800 ring-1 ring-emerald-200">
          L’adresse est active : tout email transféré arrive en quelques secondes, pièces jointes comprises.
          Vous pouvez aussi glisser un fichier <span className="font-mono">.eml</span> directement dans la zone de dépôt.
        </p>
      </div>
    </Shell>
  );
}

/** Popup « WhatsApp / SMS » : comment apporter une conversation. */
export function WhatsAppHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Shell onClose={onClose}>
      <Header title="Ajouter une conversation" onClose={onClose} />
      <div className="space-y-5 overflow-y-auto p-5">
        <p className="text-sm text-muted-foreground">
          Vos échanges avec le client font partie des preuves. Voici comment me les confier — je reconstitue
          la chronologie datée.
        </p>

        <div className="rounded-2xl border bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-4 text-emerald-600" />
            <h3 className="text-sm font-semibold">Depuis WhatsApp</h3>
          </div>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-strong">1</span>
              Ouvrez la conversation concernée.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-strong">2</span>
              <span>Menu <span className="font-medium text-foreground">⋮</span> (ou le nom du contact) → <span className="font-medium text-foreground">Exporter la discussion</span>.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-strong">3</span>
              <span>Choisissez <span className="font-medium text-foreground">Sans les médias</span>.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-strong">4</span>
              Enregistrez le fichier <span className="font-mono">.txt</span>, puis glissez-le dans la zone de dépôt.
            </li>
          </ol>
        </div>

        <div className="rounded-2xl border bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <Smartphone className="size-4 text-brand-strong" />
            <h3 className="text-sm font-semibold">Depuis vos SMS</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Faites une ou plusieurs captures d’écran de la conversation et déposez les images ici : je lis leur
            contenu. Vous pouvez en sélectionner plusieurs d’un coup.
          </p>
        </div>
      </div>
    </Shell>
  );
}
