"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Download,
  FileText,
  FolderCheck,
  Inbox,
  Mail,
  MailOpen,
  MailPlus,
  MessageCircle,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  StickyNote,
  Tag,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  createSampleInbox,
  deleteInboxItem,
  deleteLabel,
  deleteSampleInbox,
  toggleItemArchived,
  toggleItemRead,
} from "@/lib/inbox/actions";
import { LABEL_COLORS } from "@/lib/inbox/label-colors";
import {
  CopyAddress,
  InboxUploader,
  ItemActions,
  NewLabelForm,
  PasteEmailForm,
} from "@/components/app/inbox";

export type InboxItem = {
  id: string;
  source: string;
  from_name: string | null;
  from_contact: string | null;
  subject: string;
  excerpt: string | null;
  body_text: string | null;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  label_id: string | null;
  case_id: string | null;
  is_read: boolean;
  is_archived: boolean;
  is_sample: boolean;
  received_at: string;
  attachments: { id: string; file_name: string; mime_type: string; size_bytes: number }[];
};

type Label = { id: string; name: string; color: string };
type Case = { id: string; title: string; case_type: string };
type Override = { is_read?: boolean; is_archived?: boolean; deleted?: boolean };

const SOURCE_META: Record<
  string,
  { icon: typeof Mail; label: string; tint: string }
> = {
  email: { icon: Mail, label: "Email", tint: "text-sky-600 bg-sky-50" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", tint: "text-[#1DA851] bg-[#25D366]/10" },
  fichier: { icon: FileText, label: "Fichier", tint: "text-brand-strong bg-brand-soft" },
  note: { icon: StickyNote, label: "Note", tint: "text-amber-700 bg-amber-50" },
};

function sourceMeta(s: string) {
  return SOURCE_META[s] ?? SOURCE_META.fichier;
}

function fd(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

function smartTime(iso: string, now: number): string {
  const d = new Date(iso);
  const t = d.getTime();
  const sameDay = new Date(now).toDateString() === d.toDateString();
  if (sameDay) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const yesterday = now - t < 48 * 3600 * 1000 && new Date(now - 24 * 3600 * 1000).toDateString() === d.toDateString();
  if (yesterday) return "hier";
  const sameYear = new Date(now).getFullYear() === d.getFullYear();
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: sameYear ? undefined : "2-digit" });
}

function longWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

export function InboxClient({
  items,
  labels,
  cases,
  caseTitles,
  address,
  hasSamples,
}: {
  items: InboxItem[];
  labels: Label[];
  cases: Case[];
  caseTitles: Record<string, string>;
  address: string;
  hasSamples: boolean;
}) {
  const [folder, setFolder] = useState<string>("boite");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [modal, setModal] = useState<"upload" | "email" | "address" | "labels" | null>(null);
  const [, startTransition] = useTransition();
  const markedRef = useRef<Set<string>>(new Set());
  // eslint-disable-next-line react-hooks/purity -- horodatage d'affichage relatif
  const nowMs = Date.now();

  const labelById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);

  const merged = useMemo(
    () =>
      items
        .map((i) => {
          const o = overrides[i.id];
          return o ? { ...i, is_read: o.is_read ?? i.is_read, is_archived: o.is_archived ?? i.is_archived } : i;
        })
        .filter((i) => !overrides[i.id]?.deleted),
    [items, overrides],
  );

  const counts = useMemo(() => {
    const c = { unread: 0, verses: 0, traites: 0, byLabel: new Map<string, number>() };
    for (const i of merged) {
      if (i.is_archived) c.traites += 1;
      else {
        if (!i.is_read) c.unread += 1;
        if (i.label_id) c.byLabel.set(i.label_id, (c.byLabel.get(i.label_id) ?? 0) + 1);
      }
      if (i.case_id) c.verses += 1;
    }
    return c;
  }, [merged]);

  const inFolder = (i: InboxItem) => {
    if (folder === "boite") return !i.is_archived;
    if (folder === "traites") return i.is_archived;
    if (folder === "verses") return !!i.case_id;
    if (folder.startsWith("label:")) return !i.is_archived && i.label_id === folder.slice(6);
    return true;
  };

  const q = query.trim().toLowerCase();
  // Changer de dossier sort toujours de la recherche (rail ET chips).
  const goFolder = (f: string) => {
    setFolder(f);
    setQuery("");
  };
  const visible = useMemo(() => {
    if (q) {
      return merged.filter((i) =>
        [i.subject, i.from_name, i.from_contact, i.excerpt, i.body_text]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q)),
      );
    }
    return merged.filter(inFolder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merged, folder, q]);

  const selected = selectedId ? merged.find((i) => i.id === selectedId) ?? null : null;

  // Marque lu à l'ouverture (une seule fois), optimiste + action de fond.
  const openItem = (id: string) => {
    setSelectedId(id);
    const it = merged.find((i) => i.id === id);
    if (it && !it.is_read && !markedRef.current.has(id)) {
      markedRef.current.add(id);
      setOverrides((o) => ({ ...o, [id]: { ...o[id], is_read: true } }));
      startTransition(() => void toggleItemRead(fd({ id, read: "true" })));
    }
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/app/inbox?item=${id}`);
    }
  };

  const closeItem = () => {
    setSelectedId(null);
    if (typeof window !== "undefined") window.history.replaceState(null, "", "/app/inbox");
  };

  const neighbourAfter = (id: string): string | null => {
    const idx = visible.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    return visible[idx + 1]?.id ?? visible[idx - 1]?.id ?? null;
  };

  const setArchived = (id: string, archived: boolean) => {
    const advancing = archived && selectedId === id;
    const next = advancing ? neighbourAfter(id) : null;
    setOverrides((o) => ({ ...o, [id]: { ...o[id], is_archived: archived, is_read: true } }));
    // Auto-avance comme un clic (openItem → marque lu + met à jour l'URL).
    if (advancing) {
      if (next) openItem(next);
      else closeItem();
    }
    startTransition(() => void toggleItemArchived(fd({ id, archived: String(archived) })));
  };

  const setUnread = (id: string) => {
    // Retiré du set « déjà marqué lu » : rouvrir le message le re-marquera lu.
    markedRef.current.delete(id);
    setOverrides((o) => ({ ...o, [id]: { ...o[id], is_read: false } }));
    startTransition(() => void toggleItemRead(fd({ id, read: "false" })));
  };

  const remove = (id: string) => {
    const advancing = selectedId === id;
    const next = advancing ? neighbourAfter(id) : null;
    setOverrides((o) => ({ ...o, [id]: { ...o[id], deleted: true } }));
    if (advancing) {
      if (next) openItem(next);
      else closeItem();
    }
    startTransition(() => void deleteInboxItem(fd({ id })));
  };

  // Deep-link ?item= : initialisation depuis l'URL APRÈS montage (pas dans
  // l'initialiseur d'état, sinon décalage d'hydratation SSR/client).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("item");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- init une fois depuis l'URL
    if (id && items.some((i) => i.id === id)) openItem(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Raccourcis clavier (hors champs de saisie et modales).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      // Une modale ouverte (nos modales OU l'analyse email imbriquée dans
      // ItemActions, qui portent aria-modal) gèle les raccourcis.
      if (typing || modal || document.querySelector("[aria-modal]")) return;
      const idx = selectedId ? visible.findIndex((i) => i.id === selectedId) : -1;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const n = visible[Math.min(idx + 1, visible.length - 1)] ?? visible[0];
        if (n) openItem(n.id);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const n = visible[Math.max(idx - 1, 0)];
        if (n) openItem(n.id);
      } else if (selected && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        setArchived(selected.id, !selected.is_archived);
      } else if (selected && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
        setUnread(selected.id);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, selectedId, selected, modal]);

  const folderTitle = q
    ? `Résultats pour « ${query.trim()} »`
    : folder === "traites"
      ? "Traités"
      : folder === "verses"
        ? "Versés"
        : folder.startsWith("label:")
          ? labelById.get(folder.slice(6))?.name ?? "Libellé"
          : "Boîte";

  return (
    // Cadre à hauteur fixe = viewport moins le chrome réel (barre mobile 3.5rem +
    // padding du main). Le bloc mail prend le reste (flex-1) : jamais de double
    // barre de défilement de page, seules les colonnes défilent.
    <div className="flex min-h-[440px] flex-col gap-4 h-[calc(100dvh-7.5rem)] lg:h-[calc(100dvh-5rem)]">
      {/* Header : titre + recherche + Nouveau */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Boîte de réception</h1>
        <div className="flex flex-1 items-center justify-end gap-2">
          <label className="relative flex min-w-0 max-w-xs flex-1 items-center sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="w-full rounded-full border bg-card py-2.5 pl-10 pr-9 text-sm outline-none transition-all duration-300 focus:ring-2 focus:ring-brand"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Effacer la recherche"
                className="absolute right-2.5 flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </label>
          <NewMenu onOpen={(m) => setModal(m)} />
        </div>
      </div>

      {/* Chips de dossiers (mobile) */}
      <div className="flex shrink-0 gap-2 overflow-x-auto pb-1 lg:hidden">
        <FolderChip active={folder === "boite" && !q} onClick={() => { setFolder("boite"); setQuery(""); }} icon={Inbox} label="Boîte" count={counts.unread} accent />
        <FolderChip active={folder === "traites" && !q} onClick={() => { setFolder("traites"); setQuery(""); }} icon={Archive} label="Traités" />
        <FolderChip active={folder === "verses" && !q} onClick={() => { setFolder("verses"); setQuery(""); }} icon={FolderCheck} label="Versés" count={counts.verses} />
        {labels.map((l) => (
          <FolderChip
            key={l.id}
            active={folder === `label:${l.id}` && !q}
            onClick={() => { setFolder(`label:${l.id}`); setQuery(""); }}
            dot={LABEL_COLORS[l.color]?.dot ?? LABEL_COLORS.sable.dot}
            label={l.name}
            count={counts.byLabel.get(l.id) ?? 0}
          />
        ))}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-[1.75rem] border bg-card">
        {/* Rail (desktop) */}
        <aside className="hidden w-52 shrink-0 flex-col justify-between border-r bg-muted/20 lg:flex xl:w-56">
          <nav className="flex flex-col gap-1 overflow-y-auto p-3">
            <RailItem active={folder === "boite" && !q} onClick={() => goFolder("boite")} icon={Inbox} label="Boîte" count={counts.unread} accent />
            <RailItem active={folder === "traites" && !q} onClick={() => goFolder("traites")} icon={Archive} label="Traités" count={counts.traites} muted />
            <RailItem active={folder === "verses" && !q} onClick={() => goFolder("verses")} icon={FolderCheck} label="Versés" count={counts.verses} muted />
            {labels.length > 0 ? (
              <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                Libellés
              </p>
            ) : null}
            {labels.map((l) => {
              const c = LABEL_COLORS[l.color] ?? LABEL_COLORS.sable;
              const active = folder === `label:${l.id}` && !q;
              return (
                <div key={l.id} className="group/lbl relative">
                  <RailItem active={active} onClick={() => goFolder(`label:${l.id}`)} dot={c.dot} label={l.name} count={counts.byLabel.get(l.id) ?? 0} muted />
                  <form action={deleteLabel} className="absolute right-2 top-1/2 hidden -translate-y-1/2 group-hover/lbl:block">
                    <input type="hidden" name="id" value={l.id} />
                    <button type="submit" aria-label={`Supprimer ${l.name}`} className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-red-600">
                      <X className="size-3" />
                    </button>
                  </form>
                </div>
              );
            })}
            <div className="px-2 pt-2">
              <NewLabelForm />
            </div>
          </nav>
          <button
            type="button"
            onClick={() => setModal("address")}
            className="flex items-center gap-2 border-t px-4 py-3 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <MailPlus className="size-4 shrink-0 text-brand-strong" />
            <span className="min-w-0">
              <span className="block font-medium text-foreground">Adresse de transfert</span>
              <span className="block truncate font-mono">{address}</span>
            </span>
          </button>
        </aside>

        {/* Liste */}
        <div className="flex min-h-0 w-full flex-col border-r lg:w-[21rem] lg:shrink-0 xl:w-[23rem]">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
            <p className="truncate text-sm font-semibold">{folderTitle}</p>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {visible.length} message{visible.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {visible.length === 0 ? (
              <EmptyList folder={folder} q={q} hasSamples={hasSamples} />
            ) : (
              <ul role="list">
                {visible.map((it) => (
                  <MessageRow
                    key={it.id}
                    item={it}
                    label={it.label_id ? labelById.get(it.label_id) ?? null : null}
                    selected={selectedId === it.id}
                    now={nowMs}
                    onOpen={() => openItem(it.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Lecture (desktop) */}
        <div className="hidden min-h-0 flex-1 lg:flex">
          {selected ? (
            <ReadingPane
              key={selected.id}
              item={selected}
              labelName={selected.label_id ? labelById.get(selected.label_id)?.name ?? null : null}
              labels={labels}
              cases={cases}
              caseTitle={selected.case_id ? caseTitles[selected.case_id] ?? null : null}
              onArchive={() => setArchived(selected.id, !selected.is_archived)}
              onUnread={() => setUnread(selected.id)}
              onDelete={() => remove(selected.id)}
            />
          ) : (
            <EmptyPane address={address} onNew={() => setModal("upload")} />
          )}
        </div>
      </div>

      <p className="hidden shrink-0 px-1 text-xs text-muted-foreground/70 lg:block">
        Astuce : <kbd className="rounded border px-1">j</kbd>/<kbd className="rounded border px-1">k</kbd> pour naviguer,{" "}
        <kbd className="rounded border px-1">e</kbd> pour traiter, <kbd className="rounded border px-1">u</kbd> pour marquer non lu.
      </p>

      {/* Lecture (mobile) : panneau plein écran en portail */}
      <MobileReader open={!!selected} onClose={closeItem}>
        {selected ? (
          <ReadingPane
            key={`m-${selected.id}`}
            item={selected}
            labelName={selected.label_id ? labelById.get(selected.label_id)?.name ?? null : null}
            labels={labels}
            cases={cases}
            caseTitle={selected.case_id ? caseTitles[selected.case_id] ?? null : null}
            onArchive={() => setArchived(selected.id, !selected.is_archived)}
            onUnread={() => setUnread(selected.id)}
            onDelete={() => remove(selected.id)}
            onBack={closeItem}
          />
        ) : null}
      </MobileReader>

      {/* Modales « + Nouveau » / adresse */}
      <AnimatePresence>
        {modal === "upload" ? (
          <Modal key="m-upload" title="Ajouter à la boîte" onClose={() => setModal(null)}>
            <p className="mb-3 text-sm text-muted-foreground">
              Scannez, glissez ou choisissez un fichier : export WhatsApp, photo, PDF, email.
            </p>
            <InboxUploader />
          </Modal>
        ) : modal === "email" ? (
          <Modal key="m-email" title="Coller un email" onClose={() => setModal(null)}>
            <PasteEmailForm />
          </Modal>
        ) : modal === "address" ? (
          <Modal key="m-address" title="Votre adresse de transfert" onClose={() => setModal(null)}>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Transférez-y vos emails de clients : ils arrivent ici en quelques secondes, pièces
              jointes comprises, prêts à être versés au bon dossier.
            </p>
            <CopyAddress address={address} />
            {hasSamples ? (
              <form action={deleteSampleInbox} className="mt-5 border-t pt-4">
                <button type="submit" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                  Retirer les exemples de démonstration
                </button>
              </form>
            ) : null}
          </Modal>
        ) : modal === "labels" ? (
          <Modal key="m-labels" title="Libellés" onClose={() => setModal(null)}>
            {labels.length > 0 ? (
              <ul className="mb-4 flex flex-col divide-y">
                {labels.map((l) => {
                  const c = LABEL_COLORS[l.color] ?? LABEL_COLORS.sable;
                  return (
                    <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="flex items-center gap-2 text-sm">
                        <span className={`size-2.5 rounded-full ${c.dot}`} />
                        {l.name}
                      </span>
                      <form action={deleteLabel}>
                        <input type="hidden" name="id" value={l.id} />
                        <button
                          type="submit"
                          aria-label={`Supprimer ${l.name}`}
                          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-muted-foreground">
                Aucun libellé pour l’instant. Créez-en un pour trier vos messages par chantier ou client.
              </p>
            )}
            <NewLabelForm />
          </Modal>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ── Rail & chips ─────────────────────────────────────────────────────────────
function RailItem({
  active,
  onClick,
  icon: Icon,
  dot,
  label,
  count,
  accent,
  muted,
}: {
  active: boolean;
  onClick: () => void;
  icon?: typeof Inbox;
  dot?: string;
  label: string;
  count?: number;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors duration-200 ${
        active ? "bg-brand-soft font-semibold text-brand-strong" : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {Icon ? <Icon className="size-4.5 shrink-0" strokeWidth={1.75} /> : <span className={`size-2.5 shrink-0 rounded-full ${dot}`} />}
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {count ? (
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
            accent ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"
          } ${muted && !active ? "opacity-80" : ""}`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function FolderChip({
  active,
  onClick,
  icon: Icon,
  dot,
  label,
  count,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  icon?: typeof Inbox;
  dot?: string;
  label: string;
  count?: number;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-ink text-white" : "bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {Icon ? <Icon className="size-3.5" /> : <span className={`size-2 rounded-full ${dot}`} />}
      {label}
      {count ? (
        <span className={`rounded-full px-1 text-[10px] font-semibold ${accent && !active ? "bg-brand text-brand-foreground" : "opacity-80"}`}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

// ── Ligne de message ─────────────────────────────────────────────────────────
function MessageRow({
  item,
  label,
  selected,
  now,
  onOpen,
}: {
  item: InboxItem;
  label: Label | null;
  selected: boolean;
  now: number;
  onOpen: () => void;
}) {
  const meta = sourceMeta(item.source);
  const labelColor = label ? LABEL_COLORS[label.color] ?? LABEL_COLORS.sable : null;
  const unread = !item.is_read;
  const sender = item.from_name || item.subject;
  return (
    <li
      className={`relative border-b last:border-b-0 ${selected ? "bg-brand-soft/50" : "hover:bg-muted/50"}`}
    >
      {selected ? <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] rounded-r bg-brand" /> : null}
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 px-4 py-3 text-left">
        <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${unread ? "bg-brand" : "bg-transparent"}`} />
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${meta.tint}`}>
          <meta.icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className={`min-w-0 flex-1 truncate text-[13px] ${unread ? "font-bold text-foreground" : "font-medium text-foreground/90"}`}>
              {sender}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{smartTime(item.received_at, now)}</span>
          </span>
          <span className={`mt-0.5 block truncate text-[13px] ${unread ? "font-medium text-foreground/90" : "text-muted-foreground"}`}>
            {item.subject}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            {item.excerpt ? <span className="min-w-0 flex-1 truncate">{item.excerpt}</span> : <span className="flex-1" />}
            {item.is_sample ? <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px]">exemple</span> : null}
            {labelColor ? <span aria-hidden className={`size-2 shrink-0 rounded-full ${labelColor.dot}`} title={label?.name} /> : null}
            {item.case_id ? <FolderCheck className="size-3.5 shrink-0 text-emerald-600" /> : null}
            {item.attachments.length > 0 ? (
              <span className="flex shrink-0 items-center gap-0.5">
                <Paperclip className="size-3" />
                {item.attachments.length}
              </span>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}

// ── Panneau de lecture ───────────────────────────────────────────────────────
function ReadingPane({
  item,
  labelName,
  labels,
  cases,
  caseTitle,
  onArchive,
  onUnread,
  onDelete,
  onBack,
}: {
  item: InboxItem;
  labelName: string | null;
  labels: Label[];
  cases: Case[];
  caseTitle: string | null;
  onArchive: () => void;
  onUnread: () => void;
  onDelete: () => void;
  onBack?: () => void;
}) {
  // Note : le parent remonte ce composant via `key={item.id}` → confirmDel
  // repart à false à chaque changement de message, sans effet.
  const meta = sourceMeta(item.source);
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <div className="flex min-h-0 w-full flex-col">
      {/* Header du message */}
      <div className="shrink-0 border-b px-5 py-4">
        {onBack ? (
          <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground lg:hidden">
            <ArrowLeft className="size-4" />
            Boîte de réception
          </button>
        ) : null}
        <h2 className="text-lg font-semibold leading-tight">{item.subject}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span className={`flex size-6 items-center justify-center rounded-md ${meta.tint}`}>
            <meta.icon className="size-3.5" />
          </span>
          {item.from_name ? <span className="font-medium text-foreground">{item.from_name}</span> : null}
          {item.from_contact ? <span className="truncate">&lt;{item.from_contact}&gt;</span> : null}
          <span aria-hidden>·</span>
          <span>{longWhen(item.received_at)}</span>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{meta.label}</span>
          {labelName ? <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-strong">{labelName}</span> : null}
          {item.case_id ? (
            <Link
              href={`/app/dossiers/${item.case_id}`}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
            >
              <FolderCheck className="size-3" />
              Versé{caseTitle ? ` · ${caseTitle}` : ""}
            </Link>
          ) : null}
        </div>
      </div>

      {/* Corps + pièces jointes */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-5 py-4">
        {item.body_text ? (
          <pre className="whitespace-pre-wrap rounded-2xl bg-card p-4 font-sans text-[13.5px] leading-relaxed text-foreground/90 ring-1 ring-black/5">
            {item.body_text}
          </pre>
        ) : (
          <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-black/5">
            {item.attachments.length > 0
              ? "Pièce reçue sans message. Les fichiers sont ci-dessous."
              : "Cet élément n’a pas de contenu texte."}
          </p>
        )}

        {item.attachments.length > 0 ? (
          <div className="mt-4">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
              <Paperclip className="size-3.5" />
              {item.attachments.length} pièce{item.attachments.length > 1 ? "s" : ""} jointe{item.attachments.length > 1 ? "s" : ""}
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {item.attachments.map((a) => (
                <a
                  key={a.id}
                  href={`/app/inbox/fichier/${a.id}`}
                  className="flex items-center gap-3 rounded-2xl border bg-card px-3.5 py-2.5 text-sm transition-colors hover:border-brand/50 hover:bg-brand-soft/25"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                    <FileText className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{a.file_name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {(a.mime_type.split("/")[1] ?? "fichier").toUpperCase()} · {fileSize(a.size_bytes)}
                    </span>
                  </span>
                  <Download className="size-4 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Barre d'actions */}
      <div className="shrink-0 border-t bg-card px-5 py-3">
        {item.case_id ? (
          <p className="mb-2.5 text-sm text-muted-foreground">
            Déjà versé au dossier{" "}
            <Link href={`/app/dossiers/${item.case_id}`} className="font-medium text-brand-strong underline-offset-4 hover:underline">
              {caseTitle ?? "concerné"}
            </Link>
            .
          </p>
        ) : (
          <div className="mb-2.5">
            <ItemActions itemId={item.id} source={item.source} labelId={item.label_id} labels={labels} cases={cases} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onArchive}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
          >
            {item.is_archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
            {item.is_archived ? "Remettre en boîte" : "Marquer traité"}
          </button>
          <button
            type="button"
            onClick={onUnread}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
          >
            <MailOpen className="size-3.5" />
            Marquer non lu
          </button>
          {confirmDel ? (
            <span className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
              >
                <Trash2 className="size-3.5" />
                Confirmer
              </button>
              <button type="button" onClick={() => setConfirmDel(false)} className="rounded-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                Annuler
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-red-300 hover:text-red-600"
            >
              <Trash2 className="size-3.5" />
              Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── États vides ──────────────────────────────────────────────────────────────
function EmptyPane({ address, onNew }: { address: string; onNew: () => void }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
        <MailOpen className="size-6" strokeWidth={1.5} />
      </span>
      <div>
        <p className="font-semibold">Sélectionnez un message</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
          Cliquez un message à gauche pour le lire, ou transférez vos emails à votre adresse.
        </p>
      </div>
      <CopyAddress address={address} />
      <button type="button" onClick={onNew} className="text-sm font-medium text-brand-strong underline-offset-4 hover:underline">
        Ajouter un fichier ou coller un email
      </button>
    </div>
  );
}

function EmptyList({ folder, q, hasSamples }: { folder: string; q: string; hasSamples: boolean }) {
  const isBoite = folder === "boite" && !q;
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Inbox className="size-5" strokeWidth={1.75} />
      </span>
      <p className="text-sm font-medium">
        {q ? "Aucun résultat." : folder === "traites" ? "Rien de traité." : folder === "verses" ? "Rien de versé pour l’instant." : "Votre boîte est vide."}
      </p>
      {isBoite && !hasSamples ? (
        <form action={createSampleInbox}>
          <button type="submit" className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98]">
            Voir avec des exemples
          </button>
        </form>
      ) : null}
    </div>
  );
}

// ── « + Nouveau » ────────────────────────────────────────────────────────────
type NewKind = "upload" | "email" | "address" | "labels";

function NewMenu({ onOpen }: { onOpen: (m: NewKind) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const pick = (m: NewKind) => {
    setOpen(false);
    onOpen(m);
  };
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
      >
        <Plus className="size-4" />
        Nouveau
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border bg-card p-1.5 shadow-xl shadow-ink/10"
          >
            <MenuRow icon={UploadCloud} title="Déposer un fichier" sub="Scan, photo, PDF, WhatsApp" onClick={() => pick("upload")} />
            <MenuRow icon={MailPlus} title="Coller un email" sub="Objet + contenu" onClick={() => pick("email")} />
            <MenuRow icon={Sparkles} title="Par transfert" sub="Votre adresse dédiée" onClick={() => pick("address")} />
            <MenuRow icon={Tag} title="Gérer les libellés" sub="Créer, supprimer" onClick={() => pick("labels")} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MenuRow({ icon: Icon, title, sub, onClick }: { icon: typeof Mail; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
    </button>
  );
}

// ── Modale (portail + focus + Échap + verrou scroll) ─────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    dialog?.focus();
    const focusables = (): HTMLElement[] =>
      dialog
        ? Array.from(
            dialog.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => el.offsetParent !== null)
        : [];
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || active === dialog || !dialog.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [onClose]);

  const content = (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <motion.button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-sm"
      />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal
        aria-label={title}
        tabIndex={-1}
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: reduce ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border bg-card shadow-2xl shadow-ink/10 outline-none sm:max-w-md sm:rounded-[1.75rem]"
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <p className="text-sm font-semibold">{title}</p>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </motion.div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}

// ── Lecture mobile : feuille plein écran en portail ──────────────────────────
function MobileReader({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  const content = (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={reduce ? false : { x: "100%" }}
          animate={{ x: 0 }}
          exit={reduce ? { opacity: 0 } : { x: "100%" }}
          transition={{ duration: reduce ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 flex flex-col bg-card lg:hidden"
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}
