import { redirect } from "next/navigation";

// L'Agenda a été fusionné dans l'onglet « Suivi » (10/07/2026) : les
// prochaines étapes y vivent en liste, la grille mensuelle reste accessible
// en vue calendrier — les habitudes et favoris atterrissent directement dessus.
export default function AgendaRedirect() {
  redirect("/app/envois?vue=agenda");
}
