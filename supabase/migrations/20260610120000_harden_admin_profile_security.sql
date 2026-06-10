-- =====================================================================
-- Harden admin/profile production readiness
-- - Align direct profile RLS with the super-admin-only user-management API.
-- - Keep bootstrap auto-elevation only as first-super-admin fallback.
-- =====================================================================

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
    on public.profiles for select
    using (public.is_super_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
    on public.profiles for update
    using (public.is_super_admin())
    with check (public.is_super_admin());

create or replace function public.elevate_bootstrap_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.email = 'renvagu1@icloud.com'
       and new.role <> 'super_admin'
       and not exists (
           select 1 from public.profiles where role = 'super_admin'
       ) then
        new.role := 'super_admin';
    end if;
    return new;
end;
$$;

do $$
begin
    if not exists (
        select 1 from public.profiles where role = 'super_admin'
    ) then
        update public.profiles
            set role = 'super_admin', updated_at = now()
            where email = 'renvagu1@icloud.com';
    end if;
end;
$$;
