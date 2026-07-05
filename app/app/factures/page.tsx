import { redirect } from "next/navigation";

/** « Mes factures » = factures BLEME : elles vivent dans Mon abonnement. */
export default function FacturesRedirect() {
  redirect("/app/abonnement");
}
