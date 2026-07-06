-- Sécurité : empêcher l'auto-escalade de privilège via profiles.is_admin.
-- La policy RLS "profiles: modifier son profil" autorise un utilisateur à
-- mettre à jour SA ligne (id = auth.uid()) sans restriction de colonne. Sans
-- garde, n'importe quel compte authentifié pourrait PATCH is_admin=true avec la
-- clé anon publique et devenir admin global. Ce trigger bloque toute
-- modification de is_admin par un rôle non privilégié (authenticated/anon) qui
-- n'est pas déjà admin. Les rôles privilégiés (postgres pour les migrations et
-- le SQL editor, service_role pour le backend) restent autorisés — ainsi la
-- promotion manuelle d'un admin reste possible.

create or replace function public.guard_profile_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and coalesce(auth.role(), '') in ('authenticated', 'anon')
     and not public.is_admin() then
    raise exception 'Modification du statut administrateur non autorisée.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_admin on public.profiles;
create trigger profiles_guard_admin
  before update on public.profiles
  for each row execute function public.guard_profile_admin_flag();
