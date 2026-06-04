-- =====================================================================
-- Revert bootstrap super admin email back to renvagu1@icloud.com
-- (undoes 20260603130000_update_super_admin_email.sql)
-- =====================================================================

-- Restore the trigger so future profile inserts for the iCloud address are
-- auto-elevated to super_admin.
create or replace function public.elevate_bootstrap_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.email = 'renvagu1@icloud.com' and new.role <> 'super_admin' then
        new.role := 'super_admin';
    end if;
    return new;
end;
$$;

-- Elevate the iCloud account now if it already exists.
update public.profiles
    set role = 'super_admin', updated_at = now()
    where email = 'renvagu1@icloud.com';

-- Demote the previously-elevated gmail account back to a regular user.
update public.profiles
    set role = 'user', updated_at = now()
    where email = 'renzocarlosme@gmail.com';
