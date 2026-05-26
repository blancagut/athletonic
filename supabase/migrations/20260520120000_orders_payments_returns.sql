-- =====================================================================
-- Athletonic production commerce flow
-- Orders, Stripe payment metadata, tracking events, and returns requests.
-- =====================================================================

create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    order_reference text not null unique,
    checkout_intent_id uuid references public.checkout_intents(id) on delete set null,
    user_id uuid references auth.users(id) on delete set null,
    customer_email text not null,
    currency text not null default 'USD',
    subtotal_cents integer not null default 0,
    shipping_cents integer not null default 0,
    tax_cents integer not null default 0,
    discount_cents integer not null default 0,
    total_cents integer not null default 0,
    order_status text not null default 'pending_payment'
        check (order_status in (
            'pending_payment',
            'paid',
            'processing',
            'shipped',
            'delivered',
            'cancelled',
            'refunded'
        )),
    payment_status text not null default 'pending'
        check (payment_status in (
            'pending',
            'paid',
            'failed',
            'cancelled',
            'partially_refunded',
            'refunded'
        )),
    fulfillment_status text not null default 'not_started'
        check (fulfillment_status in (
            'not_started',
            'processing',
            'shipped',
            'delivered',
            'cancelled',
            'returned'
        )),
    stripe_checkout_session_id text unique,
    stripe_payment_intent_id text unique,
    stripe_customer_id text,
    shipping_method text,
    shipping_address jsonb,
    billing_address jsonb,
    tracking_carrier text,
    tracking_number text,
    tracking_url text,
    attribution jsonb not null default '{}'::jsonb,
    customer_ip inet,
    user_agent text,
    paid_at timestamptz,
    shipped_at timestamptz,
    delivered_at timestamptz,
    cancelled_at timestamptz,
    refunded_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint orders_reference_format check (order_reference ~ '^ATH-[A-Z0-9]{10}$'),
    constraint orders_email_format check (customer_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
    constraint orders_currency_format check (currency ~ '^[A-Z]{3}$'),
    constraint orders_amounts_nonnegative check (
        subtotal_cents >= 0
        and shipping_cents >= 0
        and tax_cents >= 0
        and discount_cents >= 0
        and total_cents >= 0
    ),
    constraint orders_total_matches_parts check (
        total_cents = subtotal_cents + shipping_cents + tax_cents - discount_cents
    )
);

create table if not exists public.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete cascade,
    product_id text not null,
    sku text,
    brand text not null,
    name text not null,
    variant text,
    image_url text,
    quantity integer not null,
    unit_amount_cents integer not null,
    line_subtotal_cents integer not null,
    currency text not null default 'USD',
    product_snapshot jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint order_items_quantity_valid check (quantity > 0 and quantity <= 99),
    constraint order_items_amounts_valid check (
        unit_amount_cents >= 0
        and line_subtotal_cents = quantity * unit_amount_cents
    ),
    constraint order_items_currency_format check (currency ~ '^[A-Z]{3}$')
);

create table if not exists public.order_status_events (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete cascade,
    status text not null,
    message text,
    created_by text not null default 'system',
    created_at timestamptz not null default now()
);

create table if not exists public.stripe_webhook_events (
    id text primary key,
    type text not null,
    api_version text,
    livemode boolean not null default false,
    order_id uuid references public.orders(id) on delete set null,
    payload jsonb not null,
    processed_at timestamptz,
    error text,
    created_at timestamptz not null default now()
);

create table if not exists public.return_requests (
    id uuid primary key default gen_random_uuid(),
    return_reference text not null unique,
    order_id uuid not null references public.orders(id) on delete restrict,
    customer_email text not null,
    requested_resolution text not null default 'refund'
        check (requested_resolution in ('refund', 'replacement')),
    status text not null default 'requested'
        check (status in (
            'requested',
            'under_review',
            'approved',
            'rejected',
            'received',
            'refunded',
            'replaced'
        )),
    reason text not null,
    customer_notes text,
    admin_notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint return_requests_reference_format check (return_reference ~ '^RET-[A-Z0-9]{10}$'),
    constraint return_requests_email_format check (customer_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

create table if not exists public.return_request_items (
    id uuid primary key default gen_random_uuid(),
    return_request_id uuid not null references public.return_requests(id) on delete cascade,
    order_item_id uuid not null references public.order_items(id) on delete restrict,
    quantity integer not null default 1,
    reason text,
    created_at timestamptz not null default now(),
    constraint return_request_items_quantity_valid check (quantity > 0 and quantity <= 99)
);

create table if not exists public.return_request_photos (
    id uuid primary key default gen_random_uuid(),
    return_request_id uuid not null references public.return_requests(id) on delete cascade,
    storage_bucket text not null default 'return-photos',
    storage_path text not null,
    original_filename text,
    mime_type text,
    file_size integer,
    created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_email_reference_idx on public.orders(lower(customer_email), order_reference);
create index if not exists orders_order_status_idx on public.orders(order_status);
create index if not exists orders_payment_status_idx on public.orders(payment_status);
create index if not exists orders_stripe_checkout_session_idx on public.orders(stripe_checkout_session_id);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_status_events_order_id_idx on public.order_status_events(order_id, created_at desc);
create index if not exists return_requests_order_id_idx on public.return_requests(order_id);
create index if not exists return_requests_status_idx on public.return_requests(status);
create index if not exists return_requests_reference_email_idx on public.return_requests(return_reference, lower(customer_email));
create index if not exists return_request_items_request_id_idx on public.return_request_items(return_request_id);
create index if not exists return_request_photos_request_id_idx on public.return_request_photos(return_request_id);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
    before update on public.orders
    for each row execute function public.tg_set_updated_at();

drop trigger if exists return_requests_set_updated_at on public.return_requests;
create trigger return_requests_set_updated_at
    before update on public.return_requests
    for each row execute function public.tg_set_updated_at();

create or replace function public.generate_order_reference(p_prefix text default 'ATH')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    candidate text;
begin
    loop
        candidate := upper(p_prefix) || '-' || upper(encode(gen_random_bytes(5), 'hex'));
        exit when not exists (
            select 1 from public.orders where order_reference = candidate
        ) and not exists (
            select 1 from public.return_requests where return_reference = candidate
        );
    end loop;

    return candidate;
end;
$$;

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
    p_attribution jsonb default '{}'::jsonb
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

create or replace function public.confirm_order_payment(
    p_order_id uuid,
    p_stripe_checkout_session_id text,
    p_stripe_payment_intent_id text,
    p_stripe_customer_id text,
    p_amount_subtotal_cents integer,
    p_amount_shipping_cents integer,
    p_amount_tax_cents integer,
    p_amount_discount_cents integer,
    p_amount_total_cents integer,
    p_shipping_method text default null,
    p_shipping_address jsonb default null,
    p_billing_address jsonb default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
    updated_order public.orders;
begin
    update public.orders
    set
        order_status = case
            when order_status in ('cancelled', 'refunded') then order_status
            else 'paid'
        end,
        payment_status = case
            when payment_status = 'refunded' then payment_status
            else 'paid'
        end,
        stripe_checkout_session_id = coalesce(p_stripe_checkout_session_id, stripe_checkout_session_id),
        stripe_payment_intent_id = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id),
        stripe_customer_id = coalesce(p_stripe_customer_id, stripe_customer_id),
        subtotal_cents = coalesce(p_amount_subtotal_cents, subtotal_cents),
        shipping_cents = coalesce(p_amount_shipping_cents, shipping_cents),
        tax_cents = coalesce(p_amount_tax_cents, tax_cents),
        discount_cents = coalesce(p_amount_discount_cents, discount_cents),
        total_cents = coalesce(p_amount_total_cents, total_cents),
        shipping_method = coalesce(p_shipping_method, shipping_method),
        shipping_address = coalesce(p_shipping_address, shipping_address),
        billing_address = coalesce(p_billing_address, billing_address),
        paid_at = coalesce(paid_at, now())
    where id = p_order_id
    returning * into updated_order;

    if not found then
        raise exception 'Order not found' using errcode = 'P0002';
    end if;

    insert into public.order_status_events (order_id, status, message, created_by)
    values (
        p_order_id,
        'paid',
        'Payment confirmed by verified Stripe webhook.',
        'stripe_webhook'
    )
    on conflict do nothing;

    if updated_order.checkout_intent_id is not null then
        update public.checkout_intents
        set status = 'converted'
        where id = updated_order.checkout_intent_id;
    end if;

    return updated_order;
end;
$$;

create or replace function public.mark_order_checkout_cancelled(
    p_order_id uuid,
    p_stripe_checkout_session_id text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
    updated_order public.orders;
begin
    update public.orders
    set
        order_status = 'cancelled',
        payment_status = 'cancelled',
        fulfillment_status = 'cancelled',
        stripe_checkout_session_id = coalesce(p_stripe_checkout_session_id, stripe_checkout_session_id),
        cancelled_at = coalesce(cancelled_at, now())
    where id = p_order_id
      and order_status = 'pending_payment'
    returning * into updated_order;

    if found then
        insert into public.order_status_events (order_id, status, message, created_by)
        values (
            p_order_id,
            'cancelled',
            'Stripe Checkout expired or was cancelled before payment.',
            'stripe_webhook'
        );
    end if;

    return updated_order;
end;
$$;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_events enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.return_requests enable row level security;
alter table public.return_request_items enable row level security;
alter table public.return_request_photos enable row level security;

grant select on public.orders,
    public.order_items,
    public.order_status_events,
    public.return_requests,
    public.return_request_items,
    public.return_request_photos,
    public.stripe_webhook_events
to authenticated;

grant update on public.orders,
    public.return_requests
to authenticated;

revoke all on function public.create_pending_order(
    text, jsonb, integer, integer, integer, integer, text, uuid, inet, text, jsonb
) from public;
revoke all on function public.confirm_order_payment(
    uuid, text, text, text, integer, integer, integer, integer, integer, text, jsonb, jsonb
) from public;
revoke all on function public.mark_order_checkout_cancelled(uuid, text) from public;
grant execute on function public.create_pending_order(
    text, jsonb, integer, integer, integer, integer, text, uuid, inet, text, jsonb
) to service_role;
grant execute on function public.confirm_order_payment(
    uuid, text, text, text, integer, integer, integer, integer, integer, text, jsonb, jsonb
) to service_role;
grant execute on function public.mark_order_checkout_cancelled(uuid, text) to service_role;

drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin"
    on public.orders for select
    to authenticated
    using (
        user_id = auth.uid()
        or public.is_admin(auth.uid())
    );

drop policy if exists "orders_update_admin" on public.orders;
create policy "orders_update_admin"
    on public.orders for update
    to authenticated
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));

drop policy if exists "order_items_select_own_or_admin" on public.order_items;
create policy "order_items_select_own_or_admin"
    on public.order_items for select
    to authenticated
    using (
        exists (
            select 1 from public.orders o
            where o.id = order_items.order_id
              and (o.user_id = auth.uid() or public.is_admin(auth.uid()))
        )
    );

drop policy if exists "order_status_events_select_own_or_admin" on public.order_status_events;
create policy "order_status_events_select_own_or_admin"
    on public.order_status_events for select
    to authenticated
    using (
        exists (
            select 1 from public.orders o
            where o.id = order_status_events.order_id
              and (o.user_id = auth.uid() or public.is_admin(auth.uid()))
        )
    );

drop policy if exists "stripe_webhook_events_select_admin" on public.stripe_webhook_events;
create policy "stripe_webhook_events_select_admin"
    on public.stripe_webhook_events for select
    to authenticated
    using (public.is_admin(auth.uid()));

drop policy if exists "return_requests_select_own_or_admin" on public.return_requests;
create policy "return_requests_select_own_or_admin"
    on public.return_requests for select
    to authenticated
    using (
        public.is_admin(auth.uid())
        or exists (
            select 1 from public.orders o
            where o.id = return_requests.order_id
              and o.user_id = auth.uid()
        )
    );

drop policy if exists "return_requests_update_admin" on public.return_requests;
create policy "return_requests_update_admin"
    on public.return_requests for update
    to authenticated
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));

drop policy if exists "return_request_items_select_own_or_admin" on public.return_request_items;
create policy "return_request_items_select_own_or_admin"
    on public.return_request_items for select
    to authenticated
    using (
        public.is_admin(auth.uid())
        or exists (
            select 1
            from public.return_requests rr
            join public.orders o on o.id = rr.order_id
            where rr.id = return_request_items.return_request_id
              and o.user_id = auth.uid()
        )
    );

drop policy if exists "return_request_photos_select_admin" on public.return_request_photos;
create policy "return_request_photos_select_admin"
    on public.return_request_photos for select
    to authenticated
    using (public.is_admin(auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'return-photos',
    'return-photos',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "return_photos_admin_select" on storage.objects;
create policy "return_photos_admin_select"
    on storage.objects for select
    to authenticated
    using (
        bucket_id = 'return-photos'
        and public.is_admin(auth.uid())
    );
