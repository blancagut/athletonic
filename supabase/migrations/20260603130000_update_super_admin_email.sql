-- =====================================================================
-- Update bootstrap super admin email to renzocarlosme@gmail.com
-- =====================================================================

-- Refresh the trigger so future profile inserts for the new address are
-- auto-elevated to super_admin.
create or replace function public.elevate_bootstrap_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.email = 'renzocarlosme@gmail.com' and new.role <> 'super_admin' then
        new.role := 'super_admin';
    end if;
    return new;
end;
$$;

-- Elevate the account now if it already exists.
update public.profiles
    set role = 'super_admin', updated_at = now()
    where email = 'renzocarlosme@gmail.com';
