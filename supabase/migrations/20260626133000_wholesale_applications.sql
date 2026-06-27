-- =====================================================================
-- Wholesale applications
-- - Private application intake for wholesale access.
-- - Super admin reviews pending applications and sends a decision email.
-- - Approved applications can be converted into private_pricing_grants.
-- =====================================================================

create table if not exists public.wholesale_applications (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    full_name text not null,
    company_name text not null,
    business_type text not null,
    phone text not null,
    website_url text,
    address_line1 text not null,
    address_line2 text,
    city text not null,
    region text not null,
    postal_code text not null,
    country text not null default 'US',
    monthly_volume text not null,
    product_interest text not null,
    business_plan text not null,
    notes text,
    source_page text,
    metadata jsonb not null default '{}'::jsonb,
    status text not null default 'pending'
        check (status in ('pending', 'under_review', 'approved', 'rejected')),
    decision_notes text,
    decision_email_sent_at timestamptz,
    decision_email_error text,
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewed_at timestamptz,
    converted_grant_id uuid references public.private_pricing_grants(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint wholesale_applications_email_format
        check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

create index if not exists wholesale_applications_status_created_idx
    on public.wholesale_applications(status, created_at desc);
create index if not exists wholesale_applications_email_created_idx
    on public.wholesale_applications(lower(email), created_at desc);

-- Avoid duplicate active review rows for the same email while allowing
-- resubmission after a final decision.
create unique index if not exists wholesale_applications_open_email_unique_idx
    on public.wholesale_applications(lower(email))
    where status in ('pending', 'under_review');

alter table public.wholesale_applications enable row level security;

drop policy if exists "wholesale_applications_select_super_admin"
    on public.wholesale_applications;
create policy "wholesale_applications_select_super_admin"
    on public.wholesale_applications for select
    using (public.is_super_admin());

drop policy if exists "wholesale_applications_write_super_admin"
    on public.wholesale_applications;
create policy "wholesale_applications_write_super_admin"
    on public.wholesale_applications for all
    using (public.is_super_admin())
    with check (public.is_super_admin());

drop trigger if exists wholesale_applications_set_updated_at
    on public.wholesale_applications;
create trigger wholesale_applications_set_updated_at
    before update on public.wholesale_applications
    for each row execute function public.tg_set_updated_at();
