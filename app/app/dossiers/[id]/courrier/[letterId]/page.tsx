import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ReviewLetter, type AddressDefaults, type SuggestedRecipient } from "@/components/app/review-letter";
import { toAttachableDocs } from "@/lib/courrier/attachment-rules";

export const metadata: Metadata = { title: "Relire le courrier" };

export default async function LetterReviewPage({
  params,
}: {
  params: Promise<{ id: string; letterId: string }>;
}) {
  const { id, letterId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: letter } = await supabase
    .from("letters")
    .select("id, kind, subject, body_md, status, channel, approved_at, sent_at, case_id, redaction_note")
    .eq("id", letterId)
    .eq("case_id", id)
    .maybeSingle();
  if (!letter) notFound();

  // Préremplissage des coordonnées d'envoi (dernières saisies — corrigeables)
  // + pièces du dossier proposées en annexes dans l'écran de validation.
  const [{ data: c }, { data: docs }] = await Promise.all([
    supabase
      .from("cases")
      .select("case_type, debtor_name, debtor_email, debtor_address, suggested_recipients, organization_id")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("documents")
      .select("id, doc_kind, file_name, mime_type, size_bytes")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const { data: orgRow } = c
    ? await supabase
        .from("organizations")
        .select("name, address_json")
        .eq("id", c.organization_id)
        .maybeSingle()
    : { data: null };
  const defaultToAddress: AddressDefaults =
    (c?.debtor_address as AddressDefaults) ?? (c?.debtor_name ? { societe: c.debtor_name } : null);
  const defaultFromAddress: AddressDefaults =
    (orgRow?.address_json as AddressDefaults) ?? (orgRow?.name ? { societe: orgRow.name } : null);
  const suggestedRecipients = (
    (c?.suggested_recipients as SuggestedRecipient[] | null) ?? []
  ).filter((r) => r && typeof r.nom === "string");

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/app/dossiers/${id}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Retour au dossier
      </Link>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">Relire et valider</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Le brouillon a été préparé à partir des faits de votre dossier. Rien
        n’est envoyé tant que vous n’avez pas validé.
      </p>
      <div className="mt-6">
        <ReviewLetter
          letter={letter}
          caseId={id}
          caseType={c?.case_type ?? ""}
          defaultEmail={c?.debtor_email ?? ""}
          defaultToAddress={defaultToAddress}
          defaultFromAddress={defaultFromAddress}
          suggestedRecipients={suggestedRecipients}
          documents={toAttachableDocs(docs)}
        />
      </div>
    </div>
  );
}
