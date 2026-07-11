"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";
import { sendEmail } from "@/lib/services/email";
import { proInviteEmail, teamInviteEmail } from "@/lib/team/emails";

export type InviteKind = "team" | "accountant" | "lawyer";

export type InviteState = {
  error?: string;
  success?: string;
  /** Lien de rattachement (invitations d'équipe uniquement). */
  inviteUrl?: string;
  /** L'email d'invitation est bien parti. */
  emailed?: boolean;
  /** Écho pour l'écran de succès. */
  kind?: InviteKind;
  invitedLabel?: string;
};

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

const inviteSchema = z.object({
  kind: z.enum(["team", "accountant", "lawyer"]),
  email: z.string().trim().toLowerCase().email("Entrez une adresse email valide."),
  fullName: optionalText(120),
  firmName: optionalText(160),
  phone: optionalText(30),
  role: z.enum(["member", "admin"]).optional(),
  message: optionalText(600),
});

/** Contexte : utilisateur courant, son organisation, son nom, son rôle. */
async function inviterContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." as const };

  const [{ data: org }, { data: profile }] = await Promise.all([
    supabase.from("organizations").select("id, name").limit(1).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  if (!org) return { error: "Organisation introuvable." as const };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    org,
    inviterName: profile?.full_name?.trim() || user.email || "Un membre de l'équipe",
    inviterRole: membership?.role ?? "member",
  };
}

export async function sendInvitation(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const parsed = inviteSchema.safeParse({
    kind: formData.get("kind"),
    email: formData.get("email"),
    fullName: formData.get("fullName") ?? "",
    firmName: formData.get("firmName") ?? "",
    phone: formData.get("phone") ?? "",
    role: formData.get("role") || undefined,
    message: formData.get("message") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { kind, email, fullName, firmName, phone, message } = parsed.data;

  const ctx = await inviterContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user, org, inviterName, inviterRole } = ctx;

  if (kind === "team" && email === user.email?.toLowerCase()) {
    return { error: "Vous faites déjà partie de l'équipe." };
  }

  // Seul un propriétaire peut accorder le rôle administrateur.
  const role =
    kind === "team" && parsed.data.role === "admin" && inviterRole === "owner"
      ? "admin"
      : "member";

  const { data: invite, error } = await supabase
    .from("invitations")
    .insert({
      organization_id: org.id,
      inviter_id: user.id,
      kind,
      role,
      email,
      full_name: fullName || null,
      firm_name: firmName || null,
      phone: phone || null,
      message: message || null,
    })
    .select("token")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { error: "Une invitation est déjà en attente pour cette adresse." };
    }
    return { error: "Impossible d'enregistrer l'invitation. Réessayez." };
  }

  const inviteUrl = invite?.token ? `${SITE_URL}/rejoindre/${invite.token}` : undefined;

  // Envoi de l'email : c'est le canal de l'invitation. En cas d'échec on garde
  // l'invitation (et le lien pour les équipes) — pas d'échec silencieux, on le
  // dit à l'utilisateur.
  let emailed = false;
  try {
    if (kind === "team" && inviteUrl) {
      const mail = teamInviteEmail({ inviterName, orgName: org.name, acceptUrl: inviteUrl, message });
      await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
    } else if (kind !== "team") {
      const mail = proInviteEmail({
        profession: kind,
        inviterName,
        orgName: org.name,
        siteUrl: SITE_URL,
        message,
      });
      await sendEmail({
        to: email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        replyTo: user.email ?? undefined,
      });
    }
    emailed = true;
  } catch {
    emailed = false;
  }

  revalidatePath("/app/equipe");

  const who = fullName || email;
  const success =
    kind === "team"
      ? emailed
        ? `Invitation envoyée à ${who}. Dès qu'elle crée son compte, elle rejoint votre équipe.`
        : "Invitation créée, mais l'email n'est pas parti. Partagez le lien ci-dessous."
      : emailed
        ? `${who} a bien été invité·e. Vos coordonnées d'échange lui sont parvenues.`
        : "Coordonnées enregistrées, mais l'email n'a pas pu partir cette fois.";

  return {
    success,
    inviteUrl: kind === "team" ? inviteUrl : undefined,
    emailed,
    kind,
    invitedLabel: who,
  };
}

/**
 * Accepte une invitation d'équipe pour un utilisateur DÉJÀ connecté dont
 * l'email correspond (chemin « ou se connecte » du flux membre). Le
 * rattachement se fait via la fonction SECURITY DEFINER accept_team_invitation.
 */
export async function acceptTeamInvitation(formData: FormData): Promise<void> {
  const token = z.string().uuid().safeParse(formData.get("token"));
  if (!token.success) redirect("/app");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/rejoindre/${token.data}`);

  const { error } = await supabase.rpc("accept_team_invitation", { p_token: token.data });
  if (error) redirect(`/rejoindre/${token.data}?erreur=1`);

  redirect("/app");
}

/** Annule une invitation en attente (soft : status = 'revoked'). */
export async function revokeInvitation(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", id.data)
    .eq("status", "pending");
  revalidatePath("/app/equipe");
}

/** Renvoie l'email d'invitation et prolonge la validité de 14 jours. */
export async function resendInvitation(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const ctx = await inviterContext();
  if ("error" in ctx) return;
  const { supabase, user, org, inviterName } = ctx;

  const { data: invite } = await supabase
    .from("invitations")
    .select("id, kind, email, message, token, status")
    .eq("id", id.data)
    .maybeSingle();
  if (!invite || invite.status !== "pending") return;

  const newExpiry = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
  await supabase.from("invitations").update({ expires_at: newExpiry }).eq("id", invite.id);

  try {
    if (invite.kind === "team") {
      const mail = teamInviteEmail({
        inviterName,
        orgName: org.name,
        acceptUrl: `${SITE_URL}/rejoindre/${invite.token}`,
        message: invite.message,
      });
      await sendEmail({ to: invite.email, subject: mail.subject, html: mail.html, text: mail.text });
    } else {
      const mail = proInviteEmail({
        profession: invite.kind as "accountant" | "lawyer",
        inviterName,
        orgName: org.name,
        siteUrl: SITE_URL,
        message: invite.message,
      });
      await sendEmail({
        to: invite.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        replyTo: user.email ?? undefined,
      });
    }
  } catch {
    // L'email a pu ne pas partir ; la validité est prolongée, l'utilisateur peut réessayer.
  }
  revalidatePath("/app/equipe");
}
