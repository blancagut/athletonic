-- =====================================================================
-- Wholesale account access
-- - Evolves the private pricing program so approved customers receive
--   wholesale pricing automatically from their authenticated account.
-- - Backwards compatible: existing access codes (code_hash) keep working.
-- - Links a grant to an auth.users row via auth_user_id so checkout can
--   apply pricing without an access code when the customer is signed in.
-- =====================================================================

alter table public.private_pricing_grants
    add column if not exists auth_user_id uuid
        references auth.users(id) on delete set null;

-- Lookups by linked account.
create index if not exists private_pricing_grants_auth_user_idx
    on public.private_pricing_grants(auth_user_id);

-- A single auth account can be linked to at most one grant.
create unique index if not exists private_pricing_grants_auth_user_unique_idx
    on public.private_pricing_grants(auth_user_id)
    where auth_user_id is not null;

-- Backfill: link existing grants to profiles by normalized email.
update public.private_pricing_grants g
    set auth_user_id = p.id,
        updated_at = now()
    from public.profiles p
    where g.auth_user_id is null
      and lower(trim(g.email)) = lower(trim(p.email));
