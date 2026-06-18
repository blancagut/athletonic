-- =====================================================================
-- Private pricing access program
-- - Grants are separate from profile roles.
-- - Codes are stored only as HMAC hashes.
-- - Checkout records the applied pricing context without exposing codes.
-- =====================================================================

create table if not exists public.private_pricing_grants (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    status text not null default 'active'
        check (status in ('active', 'revoked')),
    code_hash text not null,
    code_hint text,
    profile text not null default 'private_access',
    expires_at timestamptz,
    usage_count integer not null default 0,
    last_used_at timestamptz,
    created_by uuid references auth.users(id) on delete set null,
    revoked_by uuid references auth.users(id) on delete set null,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint private_pricing_grants_email_format
        check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
    constraint private_pricing_grants_usage_nonnegative
        check (usage_count >= 0)
);

create index if not exists private_pricing_grants_status_idx
    on public.private_pricing_grants(status);
create index if not exists private_pricing_grants_created_at_idx
    on public.private_pricing_grants(created_at desc);

alter table public.private_pricing_grants enable row level security;

drop policy if exists "private_pricing_grants_select_super_admin"
    on public.private_pricing_grants;
create policy "private_pricing_grants_select_super_admin"
    on public.private_pricing_grants for select
    using (public.is_super_admin());

drop policy if exists "private_pricing_grants_write_super_admin"
    on public.private_pricing_grants;
create policy "private_pricing_grants_write_super_admin"
    on public.private_pricing_grants for all
    using (public.is_super_admin())
    with check (public.is_super_admin());

drop trigger if exists private_pricing_grants_set_updated_at
    on public.private_pricing_grants;
create trigger private_pricing_grants_set_updated_at
    before update on public.private_pricing_grants
    for each row execute function public.tg_set_updated_at();

create table if not exists public.private_pricing_access_log (
    id uuid primary key default gen_random_uuid(),
    grant_id uuid references public.private_pricing_grants(id) on delete set null,
    email text not null,
    client_ip inet,
    success boolean not null default false,
    reason text,
    created_at timestamptz not null default now(),
    constraint private_pricing_access_log_email_format
        check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

create index if not exists private_pricing_access_log_email_created_idx
    on public.private_pricing_access_log(lower(email), created_at desc);
create index if not exists private_pricing_access_log_ip_created_idx
    on public.private_pricing_access_log(client_ip, created_at desc);

alter table public.private_pricing_access_log enable row level security;

drop policy if exists "private_pricing_access_log_select_super_admin"
    on public.private_pricing_access_log;
create policy "private_pricing_access_log_select_super_admin"
    on public.private_pricing_access_log for select
    using (public.is_super_admin());

create or replace function public.increment_private_pricing_usage(p_grant_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
    update public.private_pricing_grants
        set usage_count = usage_count + 1,
            last_used_at = now(),
            updated_at = now()
        where id = p_grant_id;
$$;

alter table public.checkout_intents
    add column if not exists discount_cents integer not null default 0,
    add column if not exists total numeric(10, 2) not null default 0,
    add column if not exists pricing_context jsonb not null default '{}'::jsonb;

alter table public.checkout_intents
    drop constraint if exists checkout_intents_discount_cents_nonnegative;
alter table public.checkout_intents
    add constraint checkout_intents_discount_cents_nonnegative
    check (discount_cents >= 0);

alter table public.orders
    add column if not exists private_pricing_grant_id uuid
        references public.private_pricing_grants(id) on delete set null,
    add column if not exists pricing_context jsonb not null default '{}'::jsonb;

create index if not exists orders_private_pricing_grant_idx
    on public.orders(private_pricing_grant_id);

create or replace function public.create_pending_order(
    p_customer_email text,
    p_items jsonb,
    p_subtotal_cents integer,
    p_shipping_cents integer default 0,
    p_tax_cents integer default 0,
    p_discount_cents integer default 0,
    p_currency text default 'USD',
    p_checkout_intent_id uuid default null,
    p_customer_ip inet default null,
    p_user_agent text default null,
    p_attribution jsonb default '{}'::jsonb,
    p_private_pricing_grant_id uuid default null,
    p_pricing_context jsonb default '{}'::jsonb
)
returns table (order_id uuid, order_reference text)
language plpgsql
security definer
set search_path = public
as $$
declare
    normalized_email text;
    normalized_currency text;
    new_order_id uuid;
    new_reference text;
    item jsonb;
    expected_subtotal integer := 0;
    item_quantity integer;
    item_unit_amount integer;
begin
    normalized_email := lower(trim(p_customer_email));
    normalized_currency := upper(coalesce(nullif(trim(p_currency), ''), 'USD'));

    if normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
        raise exception 'A valid email is required' using errcode = '22023';
    end if;

    if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'Order must include at least one item' using errcode = '22023';
    end if;

    for item in select value from jsonb_array_elements(p_items)
    loop
        item_quantity := coalesce((item->>'quantity')::integer, 0);
        item_unit_amount := coalesce((item->>'unit_amount_cents')::integer, -1);

        if item_quantity <= 0 or item_quantity > 99 then
            raise exception 'Invalid item quantity' using errcode = '22023';
        end if;

        if item_unit_amount < 0 then
            raise exception 'Invalid item amount' using errcode = '22023';
        end if;

        expected_subtotal := expected_subtotal + (item_quantity * item_unit_amount);
    end loop;

    if expected_subtotal <> coalesce(p_subtotal_cents, -1) then
        raise exception 'Subtotal mismatch' using errcode = '22023';
    end if;

    new_reference := public.generate_order_reference('ATH');

    insert into public.orders (
        order_reference,
        checkout_intent_id,
        user_id,
        customer_email,
        currency,
        subtotal_cents,
        shipping_cents,
        tax_cents,
        discount_cents,
        total_cents,
        order_status,
        payment_status,
        fulfillment_status,
        private_pricing_grant_id,
        pricing_context,
        attribution,
        customer_ip,
        user_agent
    )
    values (
        new_reference,
        p_checkout_intent_id,
        auth.uid(),
        normalized_email,
        normalized_currency,
        p_subtotal_cents,
        coalesce(p_shipping_cents, 0),
        coalesce(p_tax_cents, 0),
        coalesce(p_discount_cents, 0),
        p_subtotal_cents + coalesce(p_shipping_cents, 0) + coalesce(p_tax_cents, 0) - coalesce(p_discount_cents, 0),
        'pending_payment',
        'pending',
        'not_started',
        p_private_pricing_grant_id,
        coalesce(p_pricing_context, '{}'::jsonb),
        coalesce(p_attribution, '{}'::jsonb),
        p_customer_ip,
        nullif(left(coalesce(p_user_agent, ''), 500), '')
    )
    returning id into new_order_id;

    insert into public.order_items (
        order_id,
        product_id,
        sku,
        brand,
        name,
        variant,
        image_url,
        quantity,
        unit_amount_cents,
        line_subtotal_cents,
        currency,
        product_snapshot
    )
    select
        new_order_id,
        value->>'product_id',
        nullif(value->>'sku', ''),
        value->>'brand',
        value->>'name',
        nullif(value->>'variant', ''),
        nullif(value->>'image_url', ''),
        (value->>'quantity')::integer,
        (value->>'unit_amount_cents')::integer,
        (value->>'quantity')::integer * (value->>'unit_amount_cents')::integer,
        normalized_currency,
        coalesce(value->'product_snapshot', '{}'::jsonb)
    from jsonb_array_elements(p_items);

    insert into public.order_status_events (order_id, status, message, created_by)
    values (new_order_id, 'pending_payment', 'Checkout session created; awaiting Stripe confirmation.', 'checkout');

    return query select new_order_id, new_reference;
end;
$$;

revoke all on function public.increment_private_pricing_usage(uuid) from public;
grant execute on function public.increment_private_pricing_usage(uuid) to anon, authenticated;

revoke all on function public.create_pending_order(
    text,
    jsonb,
    integer,
    integer,
    integer,
    integer,
    text,
    uuid,
    inet,
    text,
    jsonb,
    uuid,
    jsonb
) from public;
grant execute on function public.create_pending_order(
    text,
    jsonb,
    integer,
    integer,
    integer,
    integer,
    text,
    uuid,
    inet,
    text,
    jsonb,
    uuid,
    jsonb
) to anon, authenticated;
