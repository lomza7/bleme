-- Renforcement du verrou is_admin : baser la garde sur auth.uid() plutôt que
-- sur la claim JWT 'role'. Un jeton utilisateur valide mais sans claim 'role'
-- donnerait auth.role() = NULL et court-circuiterait la version précédente.
-- auth.uid() est présent dès qu'il y a un contexte utilisateur ; il est NULL
-- pour postgres (migrations, SQL editor) et service_role → promotion admin
-- toujours possible par ces voies privilégiées.

create or replace function public.guard_profile_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Modification du statut administrateur non autorisée.';
  end if;
  return new;
end;
$$;
