create table if not exists public.checkout_intents (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    user_id uuid references auth.users(id) on delete set null,
    cart jsonb not null,
    subtotal numeric(10, 2) not null default 0,
    currency text not null default 'USD',
    status text not null default 'new' check (status in ('new', 'contacted', 'converted', 'cancelled')),
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint checkout_intents_email_format check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
    constraint checkout_intents_cart_array check (jsonb_typeof(cart) = 'array' and jsonb_array_length(cart) > 0)
);

create index if not exists checkout_intents_created_at_idx on public.checkout_intents(created_at desc);
create index if not exists checkout_intents_email_idx on public.checkout_intents(lower(email));
create index if not exists checkout_intents_status_idx on public.checkout_intents(status);

alter table public.checkout_intents enable row level security;

drop policy if exists "checkout_intents_insert_guest_or_user" on public.checkout_intents;
create policy "checkout_intents_insert_guest_or_user"
    on public.checkout_intents for insert
    to anon, authenticated
    with check (
        user_id is null or user_id = auth.uid()
    );

drop policy if exists "checkout_intents_select_admin" on public.checkout_intents;
create policy "checkout_intents_select_admin"
    on public.checkout_intents for select
    to authenticated
    using (public.is_admin(auth.uid()));

drop policy if exists "checkout_intents_update_admin" on public.checkout_intents;
create policy "checkout_intents_update_admin"
    on public.checkout_intents for update
    to authenticated
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));

drop trigger if exists checkout_intents_set_updated_at on public.checkout_intents;
create trigger checkout_intents_set_updated_at
    before update on public.checkout_intents
    for each row execute function public.tg_set_updated_at();