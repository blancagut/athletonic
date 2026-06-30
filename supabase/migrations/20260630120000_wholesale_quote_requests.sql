-- =====================================================================
-- Wholesale quote requests
-- - Stores private wholesale quote inquiries from the Muay Thai catalog.
-- - Uses a separate table so retail checkout and public pricing stay intact.
-- - Items are stored as JSON snapshots without any pricing fields.
-- =====================================================================

create table if not exists public.wholesale_quote_requests (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    company_name text not null,
    email text not null,
    whatsapp text not null,
    country text not null,
    notes text,
    items jsonb not null,
    item_count integer not null default 0,
    quantity_count integer not null default 0,
    source_page text,
    metadata jsonb not null default '{}'::jsonb,
    status text not null default 'new'
        check (status in ('new', 'contacted', 'quoted', 'closed', 'spam')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint wholesale_quote_requests_email_format
        check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
    constraint wholesale_quote_requests_items_array
        check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
    constraint wholesale_quote_requests_item_count_positive
        check (item_count > 0),
    constraint wholesale_quote_requests_quantity_count_positive
        check (quantity_count > 0)
);

create index if not exists wholesale_quote_requests_created_at_idx
    on public.wholesale_quote_requests(created_at desc);
create index if not exists wholesale_quote_requests_email_idx
    on public.wholesale_quote_requests(lower(email));
create index if not exists wholesale_quote_requests_status_idx
    on public.wholesale_quote_requests(status);

alter table public.wholesale_quote_requests enable row level security;

drop policy if exists "wholesale_quote_requests_insert_guest_or_user"
    on public.wholesale_quote_requests;
create policy "wholesale_quote_requests_insert_guest_or_user"
    on public.wholesale_quote_requests for insert
    to anon, authenticated
    with check (true);

drop policy if exists "wholesale_quote_requests_select_admin"
    on public.wholesale_quote_requests;
create policy "wholesale_quote_requests_select_admin"
    on public.wholesale_quote_requests for select
    to authenticated
    using (public.is_admin(auth.uid()));

drop policy if exists "wholesale_quote_requests_update_admin"
    on public.wholesale_quote_requests;
create policy "wholesale_quote_requests_update_admin"
    on public.wholesale_quote_requests for update
    to authenticated
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));

drop trigger if exists wholesale_quote_requests_set_updated_at
    on public.wholesale_quote_requests;
create trigger wholesale_quote_requests_set_updated_at
    before update on public.wholesale_quote_requests
    for each row execute function public.tg_set_updated_at();
