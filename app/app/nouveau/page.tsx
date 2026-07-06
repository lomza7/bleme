import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreateFlow } from "@/components/app/create-flow";

export const metadata: Metadata = { title: "Nouveau blème" };

export default function AppNouveauPage() {
  return (
    <div>
      <Link
        href="/app"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Tableau de bord
      </Link>
      <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">Nouveau blème</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Quelques minutes : le dossier se monte, les agents se mettent au travail à la création.
      </p>
      <div className="mt-8">
        <CreateFlow />
      </div>
    </div>
  );
}
