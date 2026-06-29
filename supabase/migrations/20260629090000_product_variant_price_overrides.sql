create table if not exists public.product_variant_price_overrides (
    product_id text not null,
    variant_id text not null,
    regular_price_cents integer not null,
    offer_price_cents integer,
    offer_enabled boolean not null default false,
    updated_by uuid references auth.users(id) on delete set null,
    updated_at timestamptz not null default now(),
    primary key (product_id, variant_id),
    constraint product_variant_price_overrides_regular_nonnegative
        check (regular_price_cents >= 0),
    constraint product_variant_price_overrides_offer_nonnegative
        check (offer_price_cents is null or offer_price_cents >= 0),
    constraint product_variant_price_overrides_offer_requires_price
        check (
            (offer_enabled = false and offer_price_cents is null)
            or (
                offer_enabled = true
                and offer_price_cents is not null
                and offer_price_cents < regular_price_cents
            )
        )
);

create index if not exists product_variant_price_overrides_product_idx
    on public.product_variant_price_overrides(product_id);

alter table public.product_variant_price_overrides enable row level security;

drop policy if exists "product_variant_price_overrides_select_super_admin"
    on public.product_variant_price_overrides;
create policy "product_variant_price_overrides_select_super_admin"
    on public.product_variant_price_overrides for select
    using (public.is_super_admin());

drop policy if exists "product_variant_price_overrides_write_super_admin"
    on public.product_variant_price_overrides;
create policy "product_variant_price_overrides_write_super_admin"
    on public.product_variant_price_overrides for all
    using (public.is_super_admin())
    with check (public.is_super_admin());

drop trigger if exists product_variant_price_overrides_set_updated_at
    on public.product_variant_price_overrides;
create trigger product_variant_price_overrides_set_updated_at
    before update on public.product_variant_price_overrides
    for each row execute function public.tg_set_updated_at();
