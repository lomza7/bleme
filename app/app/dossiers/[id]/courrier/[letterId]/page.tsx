import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ReviewLetter } from "@/components/app/review-letter";

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
    .select("id, subject, body_md, status, channel, approved_at, case_id")
    .eq("id", letterId)
    .eq("case_id", id)
    .maybeSingle();
  if (!letter) notFound();

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
        <ReviewLetter letter={letter} caseId={id} />
      </div>
    </div>
  );
}
