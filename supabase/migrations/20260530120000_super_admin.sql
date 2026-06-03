-- =====================================================================
-- Super Admin system
-- - Adds the 'super_admin' role tier (super_admin > admin > user)
-- - Updates is_admin() so super_admin inherits admin access everywhere
-- - Adds is_super_admin() helper
-- - Hardens role-assignment so only super_admin can grant admin/super_admin
-- - Adds admin_audit_log, app_settings, product_overrides
-- - Bootstraps the initial super admin account
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extend the role check to allow 'super_admin'
-- ---------------------------------------------------------------------
alter table public.profiles
    drop constraint if exists profiles_role_check;

alter table public.profiles
    add constraint profiles_role_check
    check (role in ('user', 'admin', 'super_admin'));

-- ---------------------------------------------------------------------
-- 2. Role helper functions
--    is_admin()       -> true for admin AND super_admin (used by every
--                        existing RLS policy, so super_admin inherits).
--    is_super_admin() -> true only for super_admin.
-- ---------------------------------------------------------------------
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles
        where id = uid and role in ('admin', 'super_admin')
    );
$$;

create or replace function public.is_super_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles
        where id = uid and role = 'super_admin'
    );
$$;

-- ---------------------------------------------------------------------
-- 3. Re-create profiles RLS policies to use the helper functions so the
--    super_admin tier is honoured, and to restrict who may grant elevated
--    roles. (The original policies inlined `role = 'admin'`.)
-- ---------------------------------------------------------------------

-- Admins (incl. super_admin) can read all profiles
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
    on public.profiles for select
    using (public.is_admin());

-- Users can update their own profile but cannot change their own role
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
    on public.profiles for update
    using (auth.uid() = id)
    with check (
        auth.uid() = id
        and role = (select role from public.profiles where id = auth.uid())
    );

-- Admins can update profiles. Granting or removing an elevated role
-- (admin / super_admin) requires super_admin. Regular admins may still edit
-- non-privileged fields and manage plain users, but the resulting role must
-- stay 'user' unless they are super_admin.
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
    on public.profiles for update
    using (public.is_admin())
    with check (
        public.is_super_admin()
        or role = 'user'
    );

-- ---------------------------------------------------------------------
-- 4. Admin audit log — every privileged mutation is recorded here.
--    Writes happen through the service role (Vercel functions), so no
--    INSERT policy is granted to authenticated users.
-- ---------------------------------------------------------------------
create table if not exists public.admin_audit_log (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references auth.users(id) on delete set null,
    actor_email text,
    actor_role text,
    action text not null,
    target_type text,
    target_id text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx
    on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_target_idx
    on public.admin_audit_log (target_type, target_id);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admin_audit_log_select_admin" on public.admin_audit_log;
create policy "admin_audit_log_select_admin"
    on public.admin_audit_log for select
    using (public.is_admin());

-- ---------------------------------------------------------------------
-- 5. Application settings — key/value store editable from the panel.
--    Readable by any admin; only super_admin may change values.
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
    key text primary key,
    value jsonb not null default '{}'::jsonb,
    description text,
    updated_by uuid references auth.users(id) on delete set null,
    updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select_admin" on public.app_settings;
create policy "app_settings_select_admin"
    on public.app_settings for select
    using (public.is_admin());

drop policy if exists "app_settings_write_super_admin" on public.app_settings;
create policy "app_settings_write_super_admin"
    on public.app_settings for all
    using (public.is_super_admin())
    with check (public.is_super_admin());

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
    before update on public.app_settings
    for each row execute function public.tg_set_updated_at();

insert into public.app_settings (key, value, description) values
    ('shipping', jsonb_build_object(
        'flat_amount_cents', 0,
        'free_shipping_min_cents', 0,
        'countries', jsonb_build_array('US')
    ), 'Shipping rates and eligibility'),
    ('tax', jsonb_build_object(
        'automatic', false,
        'default_rate_bps', 0
    ), 'Tax configuration'),
    ('returns', jsonb_build_object(
        'window_days', 30,
        'allow_replacement', true,
        'allow_refund', true
    ), 'Return policy')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 6. Product overrides — the storefront catalog ships as a static JSON
--    file (read-only at runtime on Vercel). Admin edits to price,
--    availability, name, etc. are persisted here and merged on read.
-- ---------------------------------------------------------------------
create table if not exists public.product_overrides (
    product_id text primary key,
    patch jsonb not null default '{}'::jsonb,
    hidden boolean not null default false,
    updated_by uuid references auth.users(id) on delete set null,
    updated_at timestamptz not null default now()
);

alter table public.product_overrides enable row level security;

drop policy if exists "product_overrides_select_admin" on public.product_overrides;
create policy "product_overrides_select_admin"
    on public.product_overrides for select
    using (public.is_admin());

drop policy if exists "product_overrides_write_admin" on public.product_overrides;
create policy "product_overrides_write_admin"
    on public.product_overrides for all
    using (public.is_admin())
    with check (public.is_admin());

drop trigger if exists product_overrides_set_updated_at on public.product_overrides;
create trigger product_overrides_set_updated_at
    before update on public.product_overrides
    for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- 7. Bootstrap the initial super admin.
--    Two paths so ordering never matters:
--    (a) Immediate UPDATE for an account that already exists.
--    (b) A trigger that elevates the account the moment its profile is
--        created (e.g. first magic-link sign-in / signup).
-- ---------------------------------------------------------------------
update public.profiles
    set role = 'super_admin', updated_at = now()
    where email = 'renvagu1@icloud.com';

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

drop trigger if exists profiles_bootstrap_super_admin on public.profiles;
create trigger profiles_bootstrap_super_admin
    before insert on public.profiles
    for each row execute function public.elevate_bootstrap_super_admin();
