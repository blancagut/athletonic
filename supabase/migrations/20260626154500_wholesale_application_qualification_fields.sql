-- =====================================================================
-- Wholesale application qualification fields
-- Adds compact review fields for business maturity, product fit, budget,
-- import readiness, channels, fulfillment, and resale/tax details.
-- =====================================================================

alter table public.wholesale_applications
    add column if not exists years_in_business text,
    add column if not exists desired_products text[] not null default '{}'::text[],
    add column if not exists investment_budget_usd text,
    add column if not exists import_experience text,
    add column if not exists sales_channel text,
    add column if not exists customer_reach text,
    add column if not exists order_frequency text,
    add column if not exists sales_regions text,
    add column if not exists fulfillment_setup text,
    add column if not exists reseller_or_tax_id text;

create index if not exists wholesale_applications_desired_products_idx
    on public.wholesale_applications using gin(desired_products);
