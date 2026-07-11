"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";
import { sendEmail } from "@/lib/services/email";
import { proInviteEmail, teamInviteEmail } from "@/lib/team/emails";
import {
  CAPABILITIES,
  can as hasCapability,
  permissionsFromRole,
  type Capability,
  type PermissionSet,
} from "@/lib/permissions/capabilities";

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

// Rôles proposés à l'invitation d'un membre d'équipe (préréglages RBAC).
const TEAM_ROLES = ["manager", "collaborator", "viewer", "accountant"] as const;
type TeamRole = (typeof TEAM_ROLES)[number];

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

const inviteSchema = z.object({
  kind: z.enum(["team", "accountant", "lawyer"]),
  email: z.string().trim().toLowerCase().email("Entrez une adresse email valide."),
  fullName: optionalText(120),
  firmName: optionalText(160),
  phone: optionalText(30),
  role: z.enum(TEAM_ROLES).optional(),
  message: optionalText(600),
});

/** Contexte : utilisateur courant, organisation, nom, rôle et droits. */
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
    .select("role, permissions")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    org,
    inviterName: profile?.full_name?.trim() || user.email || "Un membre de l'équipe",
    inviterRole: membership?.role ?? "member",
    inviterPerms: (membership?.permissions as PermissionSet | null) ?? {},
  };
}

type Ctx = Exclude<Awaited<ReturnType<typeof inviterContext>>, { error: string }>;

function ctxCan(ctx: Ctx, cap: Capability): boolean {
  return hasCapability(ctx.inviterRole, ctx.inviterPerms, cap);
}

/** Nettoie un jeu de permissions reçu du client (clés connues, booléens). */
function sanitizePermissions(raw: unknown): PermissionSet {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: PermissionSet = {};
  for (const cap of CAPABILITIES) out[cap] = Boolean(obj[cap]);
  return out;
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
  const { supabase, user, org, inviterName } = ctx;

  if (!ctxCan(ctx, "team.invite")) {
    return { error: "Vous n'avez pas le droit d'inviter des personnes." };
  }
  if (kind === "team" && email === user.email?.toLowerCase()) {
    return { error: "Vous faites déjà partie de l'équipe." };
  }

  // Rôle & droits (invitation d'équipe). Un non-propriétaire ne peut pas
  // accorder le rôle « Gestionnaire » (qui inclut la gestion des droits).
  let role: TeamRole = parsed.data.role ?? "collaborator";
  if (role === "manager" && ctx.inviterRole !== "owner") role = "collaborator";
  const permissions = kind === "team" ? permissionsFromRole(role) : {};

  const { data: invite, error } = await supabase
    .from("invitations")
    .insert({
      organization_id: org.id,
      inviter_id: user.id,
      kind,
      role: kind === "team" ? role : "collaborator",
      permissions,
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

const updateInviteSchema = z.object({
  id: z.string().uuid(),
  email: z.string().trim().toLowerCase().email("Entrez une adresse email valide."),
  fullName: optionalText(120),
  resend: z.string().optional(),
});

/** Corrige l'adresse (et le nom) d'une invitation en attente, et la renvoie. */
export async function updateInvitation(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const parsed = updateInviteSchema.safeParse({
    id: formData.get("id"),
    email: formData.get("email"),
    fullName: formData.get("fullName") ?? "",
    resend: formData.get("resend") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ctx = await inviterContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user, org, inviterName } = ctx;
  if (!ctxCan(ctx, "team.invite")) {
    return { error: "Vous n'avez pas le droit de modifier une invitation." };
  }

  const { data: invite } = await supabase
    .from("invitations")
    .select("id, kind, message, token, status")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!invite || invite.status !== "pending") {
    return { error: "Invitation introuvable ou déjà traitée." };
  }

  const { error } = await supabase
    .from("invitations")
    .update({ email: parsed.data.email, full_name: parsed.data.fullName || null })
    .eq("id", invite.id)
    .eq("status", "pending");
  if (error) {
    if (error.code === "23505") {
      return { error: "Une invitation est déjà en attente pour cette adresse." };
    }
    return { error: "Impossible d'enregistrer la correction. Réessayez." };
  }

  let emailed = false;
  if (parsed.data.resend === "1") {
    try {
      if (invite.kind === "team") {
        const mail = teamInviteEmail({
          inviterName,
          orgName: org.name,
          acceptUrl: `${SITE_URL}/rejoindre/${invite.token}`,
          message: invite.message,
        });
        await sendEmail({ to: parsed.data.email, subject: mail.subject, html: mail.html, text: mail.text });
      } else {
        const mail = proInviteEmail({
          profession: invite.kind as "accountant" | "lawyer",
          inviterName,
          orgName: org.name,
          siteUrl: SITE_URL,
          message: invite.message,
        });
        await sendEmail({
          to: parsed.data.email,
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
  }

  revalidatePath("/app/equipe");
  return {
    success: emailed
      ? `Adresse corrigée et invitation renvoyée à ${parsed.data.email}.`
      : "Adresse mise à jour.",
    kind: invite.kind as InviteKind,
    emailed,
  };
}

/** Éditer le rôle + les droits d'un membre déjà dans l'équipe. */
export async function updateMemberAccess(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const parsed = z
    .object({
      userId: z.string().uuid(),
      // 'admin'/'owner' (accès total) jamais attribuables ici — anti-escalade.
      role: z.enum(["member", "manager", "collaborator", "viewer", "accountant"]),
      permissions: z.string(),
    })
    .safeParse({
      userId: formData.get("userId"),
      role: formData.get("role"),
      permissions: formData.get("permissions"),
    });
  if (!parsed.success) return { error: "Données invalides." };

  let permsRaw: unknown;
  try {
    permsRaw = JSON.parse(parsed.data.permissions);
  } catch {
    return { error: "Droits invalides." };
  }
  const permissions = sanitizePermissions(permsRaw);

  const ctx = await inviterContext();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, org } = ctx;

  const { error } = await supabase.rpc("update_member_access", {
    p_org: org.id,
    p_user: parsed.data.userId,
    p_role: parsed.data.role,
    p_perms: permissions,
  });
  if (error) {
    return {
      error: /droit|autoris|propriétaire/i.test(error.message)
        ? "Vous n'avez pas le droit de modifier les droits de cette personne."
        : "Impossible d'enregistrer les droits. Réessayez.",
    };
  }

  revalidatePath("/app/equipe");
  return { success: "Droits mis à jour." };
}

/**
 * Accepte une invitation d'équipe pour un utilisateur DÉJÀ connecté dont
 * l'email correspond (chemin « ou se connecte » du flux membre).
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
  const ctx = await inviterContext();
  if ("error" in ctx) return;
  if (!ctxCan(ctx, "team.invite")) return;
  await ctx.supabase
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
  if (!ctxCan(ctx, "team.invite")) return;
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
