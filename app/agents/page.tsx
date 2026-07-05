import { redirect } from "next/navigation";

/* /agents renvoie vers la fiche du premier agent de l'équipe. */
export default function AgentsIndex() {
  redirect("/agents/marius");
}
