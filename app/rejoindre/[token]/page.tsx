import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, CircleAlert, Crown, LogOut, Users } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";
import { acceptTeamInvitation } from "@/lib/team/actions";
import { InviteSignupForm } from "@/components/auth/forms";

export const metadata: Metadata = {
  title: "Rejoindre une équipe",
  robots: { index: false, follow: false },
};

/*
 * Page publique de rattachement à une organisation depuis une invitation
 * d'équipe. Le token est lu en service-role (le visiteur n'est pas encore
 * membre → RLS le bloquerait). L'inscription avec l'email invité déclenche le
 * rattachement automatique (trigger handle_new_user). Hors app (pas d'auth
 * requise) : thème sombre, cohérent avec les écrans d'authentification.
 */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-ink text-ink-foreground">
      <div
        aria-hidden
        className="absolute inset-0 bg-hero-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_20%,black,transparent)]"
      />
      <div aria-hidden className="absolute -right-40 -top-40 size-[30rem] rounded-full bg-brand/20 blur-[140px]" />
      <header className="relative z-10 mx-auto w-full max-w-md px-6 pt-8">
        <Link href="/" className="text-lg font-bold tracking-tight">
          BLEME<span className="text-brand">.</span>
        </Link>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
        {children}
      </main>
      <footer className="relative z-10 mx-auto w-full max-w-md px-6 pb-8">
        <p className="text-xs text-ink-muted/70">
          Vos données sont hébergées en Europe et vous appartiennent.
        </p>
      </footer>
    </div>
  );
}

function InvalidState() {
  return (
    <div className="animate-in fade-in-0 duration-500">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
        <CircleAlert className="size-6 text-brand" />
      </span>
      <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
        Cette invitation n’est plus valable.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Le lien a peut-être expiré ou été annulé. Demandez à la personne qui vous a invité·e
        de vous en renvoyer un — ou créez votre propre espace.
      </p>
      <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/signup" className="font-medium text-ink-foreground underline-offset-4 hover:underline">
          Créer mon compte
        </Link>
        <Link href="/login" className="text-ink-muted underline-offset-4 hover:underline">
          Me connecter
        </Link>
      </p>
    </div>
  );
}

export default async function RejoindrePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ erreur?: string }>;
}) {
  const [{ token }, { erreur }] = await Promise.all([params, searchParams]);

  const service = createServiceClient();
  const { data: invite } = await service
    .from("invitations")
    .select("id, kind, role, email, full_name, organization_id, inviter_id, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  // eslint-disable-next-line react-hooks/purity -- vérification de la validité temporelle du lien
  const nowMs = Date.now();
  const valid =
    invite &&
    invite.kind === "team" &&
    invite.status === "pending" &&
    new Date(invite.expires_at).getTime() > nowMs;

  if (!valid) {
    return (
      <Shell>
        <InvalidState />
      </Shell>
    );
  }

  const [{ data: org }, { data: inviterProfile }] = await Promise.all([
    service.from("organizations").select("name").eq("id", invite.organization_id).maybeSingle(),
    invite.inviter_id
      ? service.from("profiles").select("full_name").eq("id", invite.inviter_id).maybeSingle()
      : Promise.resolve({ data: null as { full_name: string | null } | null }),
  ]);
  const orgName = org?.name ?? "votre équipe";
  const inviterName = inviterProfile?.full_name?.trim();

  // Déjà connecté ? Si l'email correspond, on propose l'acceptation en un clic ;
  // sinon on invite à repartir d'un compte propre à l'invitation.
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  const emailMatches = !!user?.email && user.email.toLowerCase() === invite.email.toLowerCase();
  let alreadyMember = false;
  if (user) {
    const { data: mem } = await service
      .from("organization_members")
      .select("id")
      .eq("organization_id", invite.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    alreadyMember = !!mem;
  }

  return (
    <Shell>
      <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-muted ring-1 ring-white/10">
          <Users className="size-3.5 text-brand" />
          Invitation
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
          {inviterName ? `${inviterName} vous invite` : "Vous êtes invité·e"} à rejoindre{" "}
          <span className="text-brand">{orgName}</span>.
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm leading-relaxed text-ink-muted">
          Vous suivrez les factures impayées et litiges de {orgName}, prêt·e à préparer les
          pièces et valider les envois.
          {invite.role === "admin" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-medium text-brand-foreground ring-1 ring-brand/30">
              <Crown className="size-3 text-brand" />
              Administrateur
            </span>
          ) : null}
        </p>

        {erreur ? (
          <p
            role="alert"
            className="mt-6 flex items-start gap-2.5 rounded-2xl bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-200 ring-1 ring-red-500/30"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            Le rattachement n’a pas pu se faire. Vérifiez que vous êtes connecté·e avec l’adresse
            invitée, ou réessayez.
          </p>
        ) : null}

        <div className="mt-8">
          {!user ? (
            <InviteSignupForm email={invite.email} fullName={invite.full_name ?? ""} token={token} />
          ) : alreadyMember ? (
            <div className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
              <p className="text-sm leading-relaxed text-ink-foreground/90">
                Vous faites déjà partie de {orgName}.
              </p>
              <Link
                href="/app"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
              >
                Ouvrir mon espace
                <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : emailMatches ? (
            <form action={acceptTeamInvitation} className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
              <input type="hidden" name="token" value={token} />
              <p className="text-sm leading-relaxed text-ink-foreground/90">
                Vous êtes connecté·e en tant que{" "}
                <span className="font-medium text-ink-foreground">{user.email}</span>. Rejoignez{" "}
                {orgName} en un clic.
              </p>
              <button
                type="submit"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
              >
                <Check className="size-4" />
                Accepter et rejoindre {orgName}
              </button>
            </form>
          ) : (
            <div className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
              <p className="text-sm leading-relaxed text-ink-foreground/90">
                Vous êtes connecté·e{user.email ? ` (${user.email})` : ""}, mais cette invitation
                est destinée à{" "}
                <span className="font-medium text-ink-foreground">{invite.email}</span>.
                Déconnectez-vous puis créez un compte avec cette adresse.
              </p>
              <form action={signOut} className="mt-4">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
                >
                  <LogOut className="size-4" />
                  Me déconnecter
                </button>
              </form>
            </div>
          )}
        </div>

        {!user ? (
          <p className="mt-6 text-sm text-ink-muted">
            Déjà un compte avec cette adresse ?{" "}
            <Link
              href={`/login?next=/rejoindre/${token}`}
              className="font-medium text-ink-foreground underline-offset-4 hover:underline"
            >
              Connectez-vous
            </Link>
          </p>
        ) : null}
      </div>
    </Shell>
  );
}
