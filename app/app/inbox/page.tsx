import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Download,
  FileText,
  FolderCheck,
  Inbox,
  Mail,
  MessageCircle,
  Paperclip,
  StickyNote,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  createSampleInbox,
  deleteInboxItem,
  deleteLabel,
  deleteSampleInbox,
  toggleItemArchived,
} from "@/lib/inbox/actions";
import {
  CopyAddress,
  InboxUploader,
  ItemActions,
  NewLabelForm,
  PasteEmailForm,
} from "@/components/app/inbox";
import { LABEL_COLORS } from "@/lib/inbox/label-colors";
import { OPEN_STATUSES, PageHeader } from "@/components/app/ui";

export const metadata: Metadata = { title: "Boîte de réception" };

const SOURCE_META = {
  email: { icon: Mail, label: "Email", tint: "text-sky-600 bg-sky-50" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", tint: "text-[#1DA851] bg-[#25D366]/10" },
  fichier: { icon: FileText, label: "Fichier", tint: "text-brand-strong bg-brand-soft" },
  note: { icon: StickyNote, label: "Note", tint: "text-amber-700 bg-amber-50" },
} as const;

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ libelle?: string; vue?: string }>;
}) {
  const { libelle, vue } = await searchParams;
  const showArchived = vue === "archives";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const { data: org } = membership
    ? await supabase
        .from("organizations")
        .select("inbox_slug")
        .eq("id", membership.organization_id)
        .maybeSingle()
    : { data: null };
  const address = `${org?.inbox_slug ?? "b-votreadresse"}@dossiers.bleme.fr`;

  const [{ data: items }, { data: labels }, { data: cases }] = await Promise.all([
    supabase
      .from("inbox_items")
      .select("*")
      .order("received_at", { ascending: false }),
    supabase.from("inbox_labels").select("id, name, color").order("created_at"),
    supabase
      .from("cases")
      .select("id, title, status, case_type")
      .in("status", [...OPEN_STATUSES])
      .order("updated_at", { ascending: false }),
  ]);

  const all = items ?? [];
  // Pièces jointes des emails reçus (affichées + téléchargeables dans le détail).
  const itemIds = all.map((i) => i.id);
  const { data: attachments } = itemIds.length
    ? await supabase
        .from("inbox_attachments")
        .select("id, inbox_item_id, file_name, mime_type, size_bytes")
        .in("inbox_item_id", itemIds)
    : { data: [] };
  const attByItem = new Map<string, { id: string; file_name: string; mime_type: string; size_bytes: number }[]>();
  for (const a of attachments ?? []) {
    const list = attByItem.get(a.inbox_item_id) ?? [];
    list.push(a);
    attByItem.set(a.inbox_item_id, list);
  }

  const hasSamples = all.some((i) => i.is_sample);
  const active = all.filter((i) => !i.is_archived);
  const list = (showArchived ? all.filter((i) => i.is_archived) : active).filter(
    (i) => !libelle || i.label_id === libelle,
  );
  const unread = active.filter((i) => !i.is_read).length;
  const countByLabel = new Map<string, number>();
  for (const i of active) {
    if (i.label_id) countByLabel.set(i.label_id, (countByLabel.get(i.label_id) ?? 0) + 1);
  }
  const labelById = new Map((labels ?? []).map((l) => [l.id, l]));
  const caseById = new Map((cases ?? []).map((c) => [c.id, c]));

  const chipBase =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Boîte de réception"
        sub="Emails, WhatsApp, fichiers : tout arrive ici, vous triez, puis vous versez chaque pièce au bon dossier."
      >
        {hasSamples ? (
          <form action={deleteSampleInbox}>
            <button
              type="submit"
              className="rounded-full border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
            >
              Retirer les exemples
            </button>
          </form>
        ) : null}
      </PageHeader>

      {/* Adresse de transfert */}
      <div className="flex flex-col gap-3 rounded-[1.75rem] border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Votre adresse de transfert</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Transférez-y vos emails de clients : ils arrivent ici en quelques
            secondes, pièces jointes comprises, prêts à être versés au bon
            dossier.
          </p>
        </div>
        <CopyAddress address={address} />
      </div>

      {/* Entrées : dépôt de fichier + email collé */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InboxUploader />
        <PasteEmailForm />
      </div>

      {/* Libellés : filtre + création */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/app/inbox"
            className={`${chipBase} ${!libelle && !showArchived ? "bg-ink text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            <Inbox className="size-3.5" />
            Boîte
            {unread > 0 ? (
              <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-brand-foreground">
                {unread}
              </span>
            ) : null}
          </Link>
          {(labels ?? []).map((l) => {
            const c = LABEL_COLORS[l.color] ?? LABEL_COLORS.sable;
            const selected = libelle === l.id;
            return (
              <span key={l.id} className="group/label relative inline-flex">
                <Link
                  href={`/app/inbox?libelle=${l.id}`}
                  className={`${chipBase} ${selected ? "bg-ink text-white" : `${c.chip} hover:opacity-80`}`}
                >
                  <span className={`size-2 rounded-full ${c.dot}`} />
                  {l.name}
                  <span className="opacity-70">{countByLabel.get(l.id) ?? 0}</span>
                </Link>
                <form action={deleteLabel} className="absolute -right-1.5 -top-1.5 hidden group-hover/label:block">
                  <input type="hidden" name="id" value={l.id} />
                  <button
                    type="submit"
                    aria-label={`Supprimer le libellé ${l.name}`}
                    className="flex size-4 items-center justify-center rounded-full bg-ink text-[9px] text-white"
                  >
                    ✕
                  </button>
                </form>
              </span>
            );
          })}
          <Link
            href="/app/inbox?vue=archives"
            className={`${chipBase} ${showArchived ? "bg-ink text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            <Archive className="size-3.5" />
            Traités
          </Link>
        </div>
        <NewLabelForm />
      </div>

      {/* Liste des éléments */}
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[1.75rem] border border-dashed px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
            <Inbox className="size-6" />
          </span>
          <div>
            <p className="font-semibold">
              {showArchived
                ? "Rien dans les éléments traités."
                : libelle
                  ? "Aucun élément sous ce libellé."
                  : "Votre boîte est vide, pour l’instant."}
            </p>
            {!showArchived && !libelle ? (
              <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
                Glissez un export WhatsApp ou une photo ci-dessus, collez un
                email, ou regardez comment la boîte fonctionne avec des
                exemples.
              </p>
            ) : null}
          </div>
          {!showArchived && !libelle && !hasSamples ? (
            <form action={createSampleInbox}>
              <button
                type="submit"
                className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-300 hover:bg-brand-strong active:scale-[0.98]"
              >
                Voir avec des exemples
              </button>
            </form>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[1.75rem] border bg-card">
          {list.map((item, idx) => {
            const meta = SOURCE_META[item.source as keyof typeof SOURCE_META] ?? SOURCE_META.fichier;
            const label = item.label_id ? labelById.get(item.label_id) : null;
            const labelColor = label ? (LABEL_COLORS[label.color] ?? LABEL_COLORS.sable) : null;
            const assignedCase = item.case_id ? caseById.get(item.case_id) : null;
            const itemAtts = attByItem.get(item.id) ?? [];
            return (
              <details key={item.id} className={`group ${idx > 0 ? "border-t" : ""}`}>
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:gap-4 sm:px-5 [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden
                    className={`size-2 shrink-0 rounded-full ${item.is_read ? "bg-transparent" : "bg-brand"}`}
                  />
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${meta.tint}`}>
                    <meta.icon className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className={`truncate text-sm ${item.is_read ? "font-medium" : "font-bold"}`}>
                        {item.subject}
                      </span>
                      {item.is_sample ? (
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          exemple
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {item.from_name ? <span className="truncate">{item.from_name}</span> : null}
                      {item.excerpt ? (
                        <span className="hidden truncate sm:inline">{item.excerpt}</span>
                      ) : null}
                    </span>
                  </span>
                  {label && labelColor ? (
                    <span className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline-flex ${labelColor.chip}`}>
                      <span className={`size-1.5 rounded-full ${labelColor.dot}`} />
                      {label.name}
                    </span>
                  ) : null}
                  {itemAtts.length > 0 ? (
                    <span
                      className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
                      title={`${itemAtts.length} pièce${itemAtts.length > 1 ? "s" : ""} jointe${itemAtts.length > 1 ? "s" : ""}`}
                    >
                      <Paperclip className="size-3.5" />
                      {itemAtts.length}
                    </span>
                  ) : null}
                  {assignedCase ? (
                    <span className="hidden shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 sm:inline-flex">
                      <FolderCheck className="size-3" />
                      Versé
                    </span>
                  ) : null}
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatWhen(item.received_at)}
                  </span>
                </summary>

                <div className="flex flex-col gap-4 border-t bg-muted/30 px-4 py-4 sm:px-5">
                  {item.body_text ? (
                    <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-white p-4 font-sans text-[13px] leading-relaxed text-foreground/90 ring-1 ring-black/5">
                      {item.body_text}
                    </pre>
                  ) : null}
                  {itemAtts.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                        <Paperclip className="size-3.5" />
                        {itemAtts.length} pièce{itemAtts.length > 1 ? "s" : ""} jointe{itemAtts.length > 1 ? "s" : ""}
                      </p>
                      {itemAtts.map((a) => (
                        <a
                          key={a.id}
                          href={`/app/inbox/fichier/${a.id}`}
                          className="flex items-center gap-3 rounded-xl border bg-card px-3.5 py-2.5 text-sm transition-colors hover:border-brand/50 hover:bg-brand-soft/25"
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                            <FileText className="size-4.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{a.file_name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {(a.mime_type.split("/")[1] ?? "fichier").toUpperCase()} · {formatSize(a.size_bytes)}
                            </span>
                          </span>
                          <Download className="size-4 shrink-0 text-muted-foreground" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {assignedCase ? (
                    <p className="text-sm text-muted-foreground">
                      Versé au dossier{" "}
                      <Link
                        href={`/app/dossiers/${assignedCase.id}`}
                        className="font-medium text-brand-strong underline-offset-4 hover:underline"
                      >
                        {assignedCase.title}
                      </Link>
                      .
                    </p>
                  ) : (
                    <ItemActions
                      itemId={item.id}
                      source={item.source}
                      labelId={item.label_id}
                      labels={labels ?? []}
                      cases={cases ?? []}
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <form action={toggleItemArchived}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="archived" value={item.is_archived ? "false" : "true"} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
                      >
                        {item.is_archived ? (
                          <>
                            <ArchiveRestore className="size-3.5" />
                            Remettre en boîte
                          </>
                        ) : (
                          <>
                            <Archive className="size-3.5" />
                            Marquer traité
                          </>
                        )}
                      </button>
                    </form>
                    <form action={deleteInboxItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-red-300 hover:text-red-600"
                      >
                        <Trash2 className="size-3.5" />
                        Supprimer
                      </button>
                    </form>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground/80">
        Astuce : créez un libellé par chantier ou par client, triez en un
        clic, puis versez. Une pièce versée rejoint les documents du dossier
        et, pour les conversations WhatsApp, alimente sa chronologie.
      </p>
    </div>
  );
}
